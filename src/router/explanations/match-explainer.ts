import type { RankingReason } from '../../domain/ranking/ranking-reason.js'
import type { SignalScore } from '../../domain/ranking/score.js'

/**
 * Turns the scored signals into the reasons a result carries.
 *
 * Only signals that actually contributed are reported: listing a signal that
 * scored nothing would suggest a match that did not happen.
 *
 * The order follows the order signals are scored in, which is fixed, so two
 * identical searches explain themselves identically.
 */
export function explainMatch(scores: readonly SignalScore[]): readonly RankingReason[] {
  return scores
    .filter((score) => score.ratio > 0 && score.detail.length > 0)
    .map((score) => ({ signal: score.signal, detail: score.detail }))
}
