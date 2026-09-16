import { scoreMetadata } from './metadata-scorer.js'
import type { SignalScore } from '../../domain/ranking/score.js'
import type { SkillQuery } from '../../domain/skill/skill-query.js'
import type { Skill } from '../../domain/skill/skill.js'
import type { RankingWeights } from './weights.js'

/** Which candidate declared a relation to a given skill name. */
export type RelatedBy = ReadonlyMap<string, string>

/**
 * Scores a skill on its own metadata, before any relation is known.
 *
 * Relations depend on the rest of the candidate set, so they can only be
 * scored once every candidate has been through this first pass.
 */
export function scoreSkill(
  skill: Skill,
  query: SkillQuery,
  weights: RankingWeights,
): readonly SignalScore[] {
  return scoreMetadata(skill, query, weights)
}

/**
 * Builds the relation map from the surviving candidates.
 *
 * Only candidates count: a skill nobody retrieved cannot vouch for another.
 * The first candidate to declare a relation wins, and since candidates arrive
 * in a fixed order, so does the attribution.
 */
export function mapRelations(candidates: readonly Skill[]): RelatedBy {
  const names = new Set(candidates.map((candidate) => candidate.manifest.name))
  const relatedBy = new Map<string, string>()

  for (const candidate of candidates) {
    for (const related of candidate.manifest.related) {
      if (related !== candidate.manifest.name && names.has(related) && !relatedBy.has(related)) {
        relatedBy.set(related, candidate.manifest.name)
      }
    }
  }

  return relatedBy
}

/**
 * The relation signal for one skill.
 *
 * Always applicable, so every candidate in a search is normalized against the
 * same total and the scores stay comparable.
 */
export function scoreRelation(skill: Skill, relatedBy: RelatedBy, weight: number): SignalScore {
  const source = relatedBy.get(skill.manifest.name)

  return {
    signal: 'related',
    weight,
    ratio: source === undefined ? 0 : 1,
    applicable: true,
    detail: source ?? '',
  }
}
