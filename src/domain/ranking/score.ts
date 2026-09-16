import type { RankingSignal } from './ranking-reason.js'

/**
 * One signal's contribution to a skill's score.
 *
 * `applicable` depends on the query, never on the skill: if it varied per
 * skill, each score would be normalized against a different total and the
 * results would stop being comparable within one search.
 */
export interface SignalScore {
  readonly signal: RankingSignal
  readonly weight: number
  /** How much of what the query asked for this signal covers, from 0 to 1. */
  readonly ratio: number
  readonly applicable: boolean
  /** What matched, for the explanation. Empty when nothing did. */
  readonly detail: string
}

/** Enough precision to separate close results, few enough digits to be stable. */
const SCORE_PRECISION = 4

export function roundScore(value: number): number {
  const factor = 10 ** SCORE_PRECISION

  return Math.round(value * factor) / factor
}

/**
 * Combines signals into a score from 0 to 1.
 *
 * The divisor only counts signals the query made applicable, so a score of 1
 * means "matched everything the query asked for" rather than "declared every
 * possible field". A query that asks for nothing measurable scores 0.
 */
export function combineSignals(scores: readonly SignalScore[]): number {
  const applicable = scores.filter((score) => score.applicable)
  const total = applicable.reduce((sum, score) => sum + score.weight, 0)

  if (total === 0) {
    return 0
  }

  const earned = applicable.reduce((sum, score) => sum + score.weight * score.ratio, 0)

  return roundScore(earned / total)
}
