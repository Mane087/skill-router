import type { SkillQuery } from '../domain/skill/skill-query.js'

/**
 * English function words, plus the "use when …" phrasing that opens most
 * hand-written skill descriptions.
 *
 * Only words of three characters or more are listed: shorter ones are dropped
 * by length anyway, so listing them would be dead weight. The list is
 * deliberately short — it removes words that carry no subject, not words that
 * merely look common. Over-filtering costs recall, which the evaluation suite
 * measures.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'also',
  'and',
  'any',
  'are',
  'been',
  'both',
  'but',
  'can',
  'does',
  'each',
  'for',
  'from',
  'had',
  'has',
  'have',
  'her',
  'him',
  'his',
  'how',
  'into',
  'its',
  'just',
  'more',
  'most',
  'much',
  'not',
  'now',
  'off',
  'one',
  'only',
  'our',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'too',
  'use',
  'used',
  'uses',
  'using',
  'very',
  'was',
  'were',
  'what',
  'when',
  'where',
  'whether',
  'which',
  'while',
  'who',
  'why',
  'will',
  'with',
  'within',
  'would',
  'you',
  'your',
])

/** Below this, a word is an article or a pronoun far more often than a term. */
const MIN_CONTENT_WORD_LENGTH = 3

/** The whole words of a free-text field, lowercased. */
export function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
}

/**
 * The whole words of a query's free text.
 *
 * Both the positive intent signal and the negative exclusions are matched
 * against this set, so a skill is included and excluded by the same rule.
 */
export function extractQueryWords(query: SkillQuery): ReadonlySet<string> {
  return new Set(splitWords([query.task, ...query.keywords].join(' ')))
}

/**
 * The words of a query that say something about its subject.
 *
 * Used to match free text against free text, where a stop word would otherwise
 * make every skill look relevant. Structured metadata does not need this: a tag
 * or an intent is a term somebody chose deliberately.
 */
export function extractContentWords(query: SkillQuery): ReadonlySet<string> {
  return new Set([...extractQueryWords(query)].filter(isContentWord))
}

function isContentWord(word: string): boolean {
  return word.length >= MIN_CONTENT_WORD_LENGTH && !STOP_WORDS.has(word)
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
