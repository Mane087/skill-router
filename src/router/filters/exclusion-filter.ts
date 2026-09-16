import { extractQueryWords, matchesAllWords } from '../query-words.js'
import type { SkillQuery } from '../../domain/skill/skill-query.js'
import type { Skill } from '../../domain/skill/skill.js'

export interface Exclusion {
  readonly signal: 'framework' | 'language' | 'intent'
  readonly detail: string
}

/**
 * The only hard filter in the router.
 *
 * Negative metadata is what cuts false positives that scoring cannot: an
 * Angular skill must not surface on a React task just because both are tagged
 * "frontend". An excluded skill is removed outright rather than ranked low,
 * because a lower score would still let it win a query with few candidates.
 *
 * Signals are checked in a fixed order so the reported exclusion is stable.
 */
export function findExclusion(skill: Skill, query: SkillQuery): Exclusion | null {
  const { excludes } = skill.manifest

  const framework = query.stack.find((term) => excludes.frameworks.includes(term))

  if (framework !== undefined) {
    return { signal: 'framework', detail: framework }
  }

  const language = query.stack.find((term) => excludes.languages.includes(term))

  if (language !== undefined) {
    return { signal: 'language', detail: language }
  }

  const words = extractQueryWords(query)
  const intent = excludes.intents.find((candidate) => matchesAllWords(candidate, words))

  return intent === undefined ? null : { signal: 'intent', detail: intent }
}
