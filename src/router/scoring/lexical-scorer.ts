import { extractQueryWords } from '../query-words.js'
import type { SignalScore } from '../../domain/ranking/score.js'
import type { SkillQuery } from '../../domain/skill/skill-query.js'
import type { Skill } from '../../domain/skill/skill.js'

/**
 * Scores a skill's tags against the free text of the query.
 *
 * Tags are matched against the task's words as well as the explicit keywords.
 * Without this the task would only ever feed the intent signal, and a query
 * that names no keyword would leave the richest thing the caller wrote unused.
 *
 * The ratio is measured against the skill's own tags: it asks how much of what
 * the skill claims to be actually shows up in the task. A skill tagged with one
 * highly relevant word therefore beats one that buries the same word among
 * twenty others.
 *
 * Matching is exact on whole words. There is no stemming, so "tests" does not
 * match "testing"; closing that gap is what the plan defers to BM25 and
 * embeddings once the evaluation suite shows it is worth the cost.
 */
export function scoreLexical(skill: Skill, query: SkillQuery, weight: number): SignalScore {
  const { tags } = skill.manifest

  if (tags.length === 0) {
    return { signal: 'tag', weight, ratio: 0, applicable: true, detail: '' }
  }

  const words = extractQueryWords(query)
  const matched = tags.filter((tag) => words.has(tag))

  return {
    signal: 'tag',
    weight,
    ratio: matched.length / tags.length,
    applicable: true,
    detail: matched.join(', '),
  }
}
