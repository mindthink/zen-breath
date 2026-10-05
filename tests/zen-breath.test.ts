import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

/** The engine pieces the mod leans on that the test host does not provide. */
function host(on: On, seen: { status?: string } = {}): void {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', (_$, e) => {
    seen.status = e.text
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
}

const PANE = {
  plugin: 'zen-breath',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'zen-breath',
  props: {
    title: '冥想',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const RUN = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

test('a one-minute session counts down, knocks once per phase, finishes and is remembered', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 9, 0, 0) })
  mock.store(on)
  host(on)

  await $.session.start({ cwd: '/tmp/zen-breath', surface: 'terminal', isInteractive: true })

  const started = await $.command.run({ ...RUN, command: 'meditate', args: '1 calm' })
  expect(started.text).toMatch(/开始 1 分钟/)

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /剩余|^完成$/ }))?.text).toBe('剩余 01:00')
  expect((await ui.find({ type: 'Text', text: /吸气|呼气|屏息|已暂停/ }))?.text).toBe('吸气 · 5')

  expect(await ui.find({ type: 'Text', text: /咚/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /敲了/ }))?.text).toBe('敲了 0 下')

  await clock.advance(1_000)
  expect(await ui.find({ type: 'Text', text: /咚/ })).toBeUndefined()

  await clock.advance(4_000)
  expect((await ui.find({ type: 'Text', text: /吸气|呼气|屏息|已暂停/ }))?.text).toBe('呼气 · 5')
  expect((await ui.find({ type: 'Text', text: /剩余|^完成$/ }))?.text).toBe('剩余 00:55')
  expect(await ui.find({ type: 'Text', text: /咚/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /敲了/ }))?.text).toBe('敲了 1 下')
  expect(await ui.find({ type: 'Text', text: /\^_\^/ })).toBeDefined()

  await clock.advance(55_000)
  expect((await ui.find({ type: 'Text', text: /剩余|^完成$/ }))?.text).toBe('完成')
  expect((await ui.find({ type: 'Text', text: /累计|第一次/ }))?.text).toBe('累计 1 次 · 1 分钟 · 连续 1 天')

  const stats = await $.command.run({ ...RUN, command: 'meditate', args: 'stats' })
  expect(stats.text).toMatch(/累计 1 次/)
  await ui.unmount()
})

test('pause holds the clock and the pattern button cycles', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  host(on)
  await $.session.start({ cwd: '/tmp/zen-breath', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...RUN, command: 'meditate', args: '2' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('暂停')
  await ui.press({ key: 'toggle' })
  expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('继续')

  await clock.advance(10_000)
  expect((await ui.find({ type: 'Text', text: /剩余|^完成$/ }))?.text).toBe('剩余 02:00')

  await ui.press({ key: 'pattern' })
  expect(await ui.find({ type: 'Text', text: /放松呼吸 4-7-8/ })).toBeDefined()
  await ui.unmount()
})

test('unknown arguments are refused with usage', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  host(on)
  await $.session.start({ cwd: '/tmp/zen-breath', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ ...RUN, command: 'meditate', args: 'banana' })
  expect(out.text).toMatch(/不认识的参数/)
})

test('the stop button ends the session and clears the status line', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen: { status?: string } = {}
  host(on, seen)
  await $.session.start({ cwd: '/tmp/zen-breath', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...RUN, command: 'meditate', args: '2' })
  await clock.advance(3_000)
  expect(seen.status).toMatch(/剩余 01:57/)

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'stop' })
  expect(seen.status).toBeUndefined()
  await clock.advance(5_000)
  expect((await ui.find({ type: 'Text', text: /剩余|^完成$/ }))?.text).toBe('剩余 02:00')
  expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('开始')
  await ui.unmount()
})
