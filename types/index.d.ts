export type Pattern = 'box' | 'relax' | 'calm'
export type PhaseKind = 'in' | 'hold' | 'out'
export type Phase = { label: string; seconds: number; kind: PhaseKind }
export type Status = 'idle' | 'running' | 'paused' | 'done'

/** The meditation in progress: what the pane draws and the ticker advances. */
export type Session = {
  status: Status
  pattern: Pattern
  totalSeconds: number
  elapsedSeconds: number
  phaseIndex: number
  phaseElapsed: number
  /** Wooden-fish strikes so far: one per breath phase. */
  knocks: number
}

/** Lifetime totals, mirrored into `$.store` under `stats`. */
export type Stats = {
  sessions: number
  minutes: number
  lastDay: string
  streak: number
}

declare module 'claude-code' {
  interface PluginState {
    'zen-breath': { session: Session; stats: Stats }
  }
}
