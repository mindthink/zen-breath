import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pattern, Phase, Session, Stats } from '../types'

const PANE = 'zen-breath'
const DEFAULT_MINUTES = 5

const PATTERNS: Record<Pattern, { name: string; phases: Phase[] }> = {
  box: {
    name: '方箱呼吸 4-4-4-4',
    phases: [
      { label: '吸气', seconds: 4, kind: 'in' },
      { label: '屏息', seconds: 4, kind: 'hold' },
      { label: '呼气', seconds: 4, kind: 'out' },
      { label: '屏息', seconds: 4, kind: 'hold' },
    ],
  },
  relax: {
    name: '放松呼吸 4-7-8',
    phases: [
      { label: '吸气', seconds: 4, kind: 'in' },
      { label: '屏息', seconds: 7, kind: 'hold' },
      { label: '呼气', seconds: 8, kind: 'out' },
    ],
  },
  calm: {
    name: '平静呼吸 5-5',
    phases: [
      { label: '吸气', seconds: 5, kind: 'in' },
      { label: '呼气', seconds: 5, kind: 'out' },
    ],
  },
}
const PATTERN_ORDER: Pattern[] = ['box', 'relax', 'calm']

const IDLE: Session = {
  status: 'idle',
  pattern: 'box',
  totalSeconds: DEFAULT_MINUTES * 60,
  elapsedSeconds: 0,
  phaseIndex: 0,
  phaseElapsed: 0,
  knocks: 0,
}
const NO_STATS: Stats = { sessions: 0, minutes: 0, lastDay: '', streak: 0 }

const session = atom({ plugin: 'zen-breath', key: 'session' } as const, IDLE)
const stats = atom({ plugin: 'zen-breath', key: 'stats' } as const, NO_STATS)

// ---------- pure helpers ----------

function isPattern(word: string): word is Pattern {
  return (PATTERN_ORDER as string[]).includes(word)
}

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.sessions === 'number' &&
    typeof v.minutes === 'number' &&
    typeof v.lastDay === 'string' &&
    typeof v.streak === 'number'
  )
}

function phaseOf(s: Session): Phase {
  const phases = PATTERNS[s.pattern].phases
  return phases[s.phaseIndex] ?? phases[0]!
}

/** One second of a running session; anything else is left as it is. */
function step(s: Session): Session {
  if (s.status !== 'running') return s
  const elapsed = s.elapsedSeconds + 1
  if (elapsed >= s.totalSeconds) {
    return { ...s, status: 'done', elapsedSeconds: s.totalSeconds }
  }
  const phases = PATTERNS[s.pattern].phases
  let phaseElapsed = s.phaseElapsed + 1
  let phaseIndex = s.phaseIndex
  let knocks = s.knocks
  if (phaseElapsed >= phaseOf(s).seconds) {
    phaseElapsed = 0
    phaseIndex = (phaseIndex + 1) % phases.length
    knocks += 1
  }
  return { ...s, elapsedSeconds: elapsed, phaseElapsed, phaseIndex, knocks }
}

/** The mallet lands on the first second of every phase: one knock per breath step. */
function isStriking(s: Session): boolean {
  return s.status === 'running' && s.phaseElapsed === 0
}

const BUDDHA: readonly string[] = [
  '        _ooOoo_',
  '       o8888888o',
  '       88" . "88',
  '       (| -_- |)',
  '       O\\  =  /O',
  "    ____/`---'\\____",
  '  .\'  \\\\|     |//  `.',
  ' /  \\\\|||  :  |||//  \\',
  '/  _||||| -:- |||||_  \\',
  '|   | \\\\\\  -  /// |   |',
  "| \\_|  ''\\---/''  |   |",
  '\\  .-\\__  `-`  ___/-. /',
  " `-.________________.-'",
  "        `=---='",
]
const EYES_ROW = 3

/** Mallet up, and mallet down on the wooden fish. */
const MALLET_UP: readonly string[] = ['    \\', '     o', '', '   ,--.', '  (____)']
const MALLET_DOWN: readonly string[] = ['', '  ((( 咚', '     o', '   ,--.', '  (____)']

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function dayOf(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return Number.NaN
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

function bump(st: Stats, minutes: number, today: string): Stats {
  const gap = daysBetween(st.lastDay, today)
  const streak = gap === 0 ? Math.max(1, st.streak) : gap === 1 ? st.streak + 1 : 1
  return {
    sessions: st.sessions + 1,
    minutes: st.minutes + minutes,
    lastDay: today,
    streak,
  }
}

function statusLine(s: Session): string | undefined {
  if (s.status === 'running') {
    return `🧘 ${phaseOf(s).label} · 剩余 ${fmt(s.totalSeconds - s.elapsedSeconds)}`
  }
  if (s.status === 'paused') return `🧘 已暂停 · 剩余 ${fmt(s.totalSeconds - s.elapsedSeconds)}`
  return undefined
}

function usage(): string {
  return '用法：/meditate [分钟] [box|relax|calm]，或 /meditate stop | stats'
}

// ---------- the ticker ----------

async function tick($: EngineInterface): Promise<void> {
  const before = await read($, session)
  if (before.status !== 'running') return
  const after = await update($, session, s => (s.status === 'running' ? step(s) : s))
  $.ui.status(statusLine(after))
  if (after.status === 'done') await finish($, after)
}

async function finish($: EngineInterface, s: Session): Promise<void> {
  const minutes = Math.max(1, Math.round(s.totalSeconds / 60))
  const today = dayOf(await $.clock.now())
  const st = await update($, stats, old => bump(old, minutes, today))
  await $.store.set('stats', st)
  $.ui.toast(`🧘 冥想完成，${minutes} 分钟。累计 ${st.sessions} 次 · 连续 ${st.streak} 天`, {
    timeoutMs: 8000,
  })
}

async function start($: EngineInterface, pattern: Pattern, minutes: number): Promise<void> {
  const fresh = await update($, session, () => ({
    ...IDLE,
    pattern,
    totalSeconds: minutes * 60,
    status: 'running' as const,
  }))
  $.ui.status(statusLine(fresh))
}

async function stop($: EngineInterface): Promise<void> {
  await update($, session, s => ({ ...s, status: 'idle' as const, elapsedSeconds: 0, phaseIndex: 0, phaseElapsed: 0, knocks: 0 }))
  $.ui.status(undefined)
}

// ---------- hooks ----------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'meditate',
      description: '冥想呼吸：开一段定时的引导呼吸面板（方箱 / 4-7-8 / 平静）',
      argumentHint: '[分钟] [box|relax|calm|stop|stats]',
    })
    const saved = await $.store.get('stats')
    if (isStats(saved)) await update($, stats, () => saved)
    $.clock.every(1000, () => {
      void tick($)
    })
    return next(e)
  })

  on('command.run', { command: 'meditate' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)

    if (words[0] === 'stop') {
      await stop($)
      await $.ui.close({ id: PANE })
      return { text: '冥想已结束。' }
    }
    if (words[0] === 'stats') {
      const st = await read($, stats)
      return {
        text:
          st.sessions === 0
            ? '还没有记录。用 /meditate 5 开始第一次。'
            : `累计 ${st.sessions} 次 · ${st.minutes} 分钟 · 连续 ${st.streak} 天（上次 ${st.lastDay}）`,
      }
    }

    let minutes = DEFAULT_MINUTES
    let pattern: Pattern = (await read($, session)).pattern
    for (const word of words) {
      const n = Number(word)
      if (Number.isFinite(n) && n > 0) minutes = Math.min(120, Math.max(1, Math.round(n)))
      else if (isPattern(word)) pattern = word
      else return { text: `不认识的参数「${word}」。${usage()}` }
    }

    await start($, pattern, minutes)
    const opened = await $.ui.open({ id: PANE, title: '冥想', focus: true })
    const head = `开始 ${minutes} 分钟 · ${PATTERNS[pattern].name}。`
    return {
      text: opened.isPlaced
        ? `${head} 面板里 p 暂停、m 换模式、q 结束。`
        : `${head} 终端太窄，面板暂不显示；进度见下方状态栏，/meditate stop 结束。`,
    }
  })

  // The person closing the pane (close mark or Escape) ends the session too.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind !== 'unload') await stop($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, session)
    const st = await read($, stats)
    const pattern = PATTERNS[s.pattern]
    const phase = phaseOf(s)
    const remaining = fmt(s.totalSeconds - s.elapsedSeconds)
    const phaseLeft = Math.max(0, phase.seconds - s.phaseElapsed)
    const isLive = s.status === 'running' || s.status === 'paused'
    const striking = isStriking(s)
    const eyes = striking || s.status === 'done' ? '^_^' : s.status === 'paused' ? '-.-' : '-_-'
    const buddha = BUDDHA.map((line, i) => (i === EYES_ROW ? line.replace('-_-', eyes) : line))
    const mallet = striking ? MALLET_DOWN : MALLET_UP

    const toggle = () =>
      update($, session, cur =>
        cur.status === 'running'
          ? { ...cur, status: 'paused' as const }
          : cur.status === 'paused'
            ? { ...cur, status: 'running' as const }
            : { ...cur, status: 'running' as const, elapsedSeconds: 0, phaseIndex: 0, phaseElapsed: 0, knocks: 0 },
      ).then(next => $.ui.status(statusLine(next)))

    const cycle = () =>
      update($, session, cur => {
        const i = PATTERN_ORDER.indexOf(cur.pattern)
        const nextPattern = PATTERN_ORDER[(i + 1) % PATTERN_ORDER.length] ?? 'box'
        return { ...cur, pattern: nextPattern, phaseIndex: 0, phaseElapsed: 0, knocks: 0 }
      }).then(next => $.ui.status(statusLine(next)))

    const quit = () => $.ui.close({ id: PANE })

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold>🧘 {pattern.name}</Text>
          <Text dimColor={!isLive}>
            {s.status === 'done' ? '完成' : `剩余 ${remaining}`}
          </Text>
        </Box>
        <Text> </Text>

        <Box>
          <Box flexDirection="column">
            {buddha.map((line, i) => (
              <Text key={`b${i}`} color={i === EYES_ROW && striking ? 'yellow' : undefined}>
                {line}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column" marginLeft={2} justifyContent="flex-end">
            {mallet.map((line, i) => (
              <Text key={`m${i}`} color={striking && i === 1 ? 'yellow' : undefined} bold={striking && i === 1}>
                {line || ' '}
              </Text>
            ))}
          </Box>
        </Box>

        <Text> </Text>
        <Box justifyContent="space-between">
          <Text bold={s.status === 'running'} dimColor={!isLive}>
            {s.status === 'done'
              ? `✓ 完成 ${Math.max(1, Math.round(s.totalSeconds / 60))} 分钟`
              : s.status === 'paused'
                ? '已暂停'
                : s.status === 'idle'
                  ? '按「开始」或输入 /meditate [分钟]'
                  : `${phase.label} · ${phaseLeft}`}
          </Text>
          <Text dimColor>敲了 {s.knocks} 下</Text>
        </Box>
        <Text> </Text>

        <Box>
          <Button
            key="toggle"
            hotkey="p"
            label={s.status === 'running' ? '暂停' : s.status === 'paused' ? '继续' : '开始'}
            onPress={toggle}
          />
          <Text> </Text>
          <Button key="pattern" hotkey="m" label="换模式" onPress={cycle} />
          <Text> </Text>
          <Button key="stop" hotkey="q" label="结束" role="dismiss" onPress={quit} />
        </Box>

        <Text> </Text>
        <Text dimColor>
          {st.sessions === 0
            ? '第一次冥想，欢迎。'
            : `累计 ${st.sessions} 次 · ${st.minutes} 分钟 · 连续 ${st.streak} 天`}
        </Text>
      </Box>
    )
  })
}
