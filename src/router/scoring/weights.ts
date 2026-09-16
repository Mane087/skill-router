import type { RankingSignal } from '../../domain/ranking/ranking-reason.js'

export type RankingWeights = Readonly<Record<RankingSignal, number>>

/**
 * Starting weights, taken from the plan's scoring model.
 *
 * These are a hypothesis, not a result. The plan is explicit that they must be
 * calibrated against the evaluation suite before anyone trusts the numbers.
 */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  phase: 30,
  framework: 25,
  intent: 20,
  file: 15,
  language: 10,
  tag: 10,
  related: 5,
}
