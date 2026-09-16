import type { SkillQuery } from '../domain/skill/skill-query.js'

/**
 * The whole words of a query's free text.
 *
 * Both the positive intent signal and the negative exclusions are matched
 * against this set, so a skill is included and excluded by the same rule.
 */
export function extractQueryWords(query: SkillQuery): ReadonlySet<string> {
  const text = [query.task, ...query.keywords].join(' ')

  return new Set(text.split(/[^a-z0-9]+/).filter((word) => word.length > 0))
}

/**
 * True when every word of a hyphenated term appears in the text.
 *
 * Whole words only: `test` must not match inside `latest`, and
 * `backend-only` must not match a task that merely says "backend".
 */
export function matchesAllWords(term: string, words: ReadonlySet<string>): boolean {
  return term.split('-').every((part) => words.has(part))
}
