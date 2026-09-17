export const RANKING_SIGNALS = [
  'phase',
  'framework',
  'language',
  'intent',
  'file',
  'tag',
  'description',
  'related',
] as const

export type RankingSignal = (typeof RANKING_SIGNALS)[number]

/** Why a skill scored what it scored, in terms the caller can act on. */
export interface RankingReason {
  readonly signal: RankingSignal
  readonly detail: string
}

const SIGNAL_LABELS: Record<RankingSignal, string> = {
  phase: 'phase',
  framework: 'framework',
  language: 'language',
  intent: 'intent',
  file: 'file pattern',
  tag: 'tag',
  description: 'description',
  related: 'related skill',
}

export function formatRankingReason(reason: RankingReason): string {
  return `${SIGNAL_LABELS[reason.signal]} matched ${reason.detail}`
}
