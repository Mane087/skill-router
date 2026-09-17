import { stemmer } from 'stemmer'

import { extractContentWords, splitWords } from '../query-words.js'
import type { SignalScore } from '../../domain/ranking/score.js'
import type { SkillQuery } from '../../domain/skill/skill-query.js'
import type { Skill } from '../../domain/skill/skill.js'

/**
 * Scores a skill's description against the free text of the query.
 *
 * Phase 12 ran the router against two real skill catalogues. Every skill in
 * them declares `name` and `description` and nothing else, so with structured
 * metadata as the only ranking input none of them could ever be retrieved. The
 * description is the one field skill authors reliably write, and it is where
 * they put the "use this when …" sentence, which is exactly what a router
 * needs.
 *
 * The ratio is measured against the query, like the framework and language
 * signals: a skill with a long description should not outrank one that answers
 * the task in a single line. Stop words are removed first, or a description
 * would match any task that contains the word "the".
 *
 * Both sides are reduced to their Porter stem before comparison. Structured
 * metadata is still matched exactly, because a tag is a term somebody chose;
 * a description is prose, and prose written by one person says "creating
 * components" where another asks to "create a component" (ADR-0011).
 */
export function scoreDescription(skill: Skill, query: SkillQuery, weight: number): SignalScore {
  const queryWords = extractContentWords(query)

  // A task made entirely of stop words says nothing to match against, so this
  // signal leaves the divisor rather than scoring every skill a zero.
  if (queryWords.size === 0) {
    return { signal: 'description', weight, ratio: 0, applicable: false, detail: '' }
  }

  const stems = new Set(splitWords(skill.manifest.description).map((word) => stemmer(word)))

  // Reported by the word the caller wrote, not by its stem: "creat" in an
  // explanation would look like a bug.
  const matched = [...queryWords].filter((word) => stems.has(stemmer(word))).sort()

  return {
    signal: 'description',
    weight,
    ratio: matched.length / queryWords.size,
    applicable: true,
    detail: matched.join(', '),
  }
}
