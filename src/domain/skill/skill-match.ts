import type { RankingReason } from '../ranking/ranking-reason.js'
import type { SkillId, SkillScope } from './skill-id.js'

/**
 * One ranked result.
 *
 * `scope` repeats what `id` already carries because a caller reading the result
 * needs to weigh a project skill differently from a global one, and should not
 * have to parse an identifier to find that out.
 */
export interface SkillMatch {
  readonly id: SkillId
  readonly scope: SkillScope
  /** From 0 to 1, relative to what the query asked for. */
  readonly score: number
  /** Never empty: a ranked result always explains itself. */
  readonly reasons: readonly RankingReason[]
}
