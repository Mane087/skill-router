import picomatch from 'picomatch'

import { extractQueryWords, matchesAllWords } from '../query-words.js'
import { scoreLexical } from './lexical-scorer.js'

import type { SignalScore } from '../../domain/ranking/score.js'
import type { SkillQuery } from '../../domain/skill/skill-query.js'
import type { Skill } from '../../domain/skill/skill.js'
import type { RankingWeights } from './weights.js'

/**
 * Scores a skill's structured metadata against a query.
 *
 * Pure and synchronous: no filesystem, no MCP, no I/O of any kind, which is
 * what makes ranking reproducible and testable on its own.
 */
export function scoreMetadata(
  skill: Skill,
  query: SkillQuery,
  weights: RankingWeights,
): readonly SignalScore[] {
  const { manifest } = skill
  const words = extractQueryWords(query)

  return [
    scorePhase(manifest.phases, query, weights.phase),
    scoreOverlap('framework', query.stack, manifest.frameworks, weights.framework),
    scoreOverlap('language', query.stack, manifest.languages, weights.language),
    scoreIntent(manifest.intents, words, weights.intent),
    scoreFiles(manifest.filePatterns, query.files, weights.file),
    scoreLexical(skill, query, weights.tag),
  ]
}

function scorePhase(phases: readonly string[], query: SkillQuery, weight: number): SignalScore {
  if (query.phase === null) {
    return notApplicable('phase', weight)
  }

  const matched = phases.includes(query.phase)

  return {
    signal: 'phase',
    weight,
    ratio: matched ? 1 : 0,
    applicable: true,
    detail: matched ? query.phase : '',
  }
}

/**
 * Scores the share of the query's terms that the skill declares.
 *
 * Measured against the query rather than against the skill: a skill listing
 * twenty frameworks should not outrank one listing the single framework the
 * task actually uses.
 */
function scoreOverlap(
  signal: 'framework' | 'language',
  queryTerms: readonly string[],
  skillTerms: readonly string[],
  weight: number,
): SignalScore {
  if (queryTerms.length === 0) {
    return notApplicable(signal, weight)
  }

  const matched = queryTerms.filter((term) => skillTerms.includes(term))

  return {
    signal,
    weight,
    ratio: matched.length / queryTerms.length,
    applicable: true,
    detail: matched.join(', '),
  }
}

/**
 * An intent matches when every word in it appears in the query text.
 *
 * Whole words only, so `test` does not match inside `latest`. The task is
 * always present, so this signal is always applicable: a skill declaring no
 * intent simply scores nothing here.
 */
function scoreIntent(
  intents: readonly string[],
  words: ReadonlySet<string>,
  weight: number,
): SignalScore {
  if (intents.length === 0) {
    return { signal: 'intent', weight, ratio: 0, applicable: true, detail: '' }
  }

  const matched = intents.filter((intent) => matchesAllWords(intent, words))

  return {
    signal: 'intent',
    weight,
    ratio: matched.length / intents.length,
    applicable: true,
    detail: matched.join(', '),
  }
}

function scoreFiles(
  patterns: readonly string[],
  files: readonly string[],
  weight: number,
): SignalScore {
  if (files.length === 0) {
    return notApplicable('file', weight)
  }

  if (patterns.length === 0) {
    return { signal: 'file', weight, ratio: 0, applicable: true, detail: '' }
  }

  const matchers = patterns.map((pattern) => ({ pattern, isMatch: picomatch(pattern) }))
  const matchedPatterns = new Set<string>()
  let matchedFiles = 0

  for (const file of files) {
    const hit = matchers.find((matcher) => matcher.isMatch(file))

    if (hit !== undefined) {
      matchedFiles += 1
      matchedPatterns.add(hit.pattern)
    }
  }

  return {
    signal: 'file',
    weight,
    ratio: matchedFiles / files.length,
    applicable: true,
    // Patterns are already sorted in the manifest, so this stays deterministic.
    detail: [...matchedPatterns].join(', '),
  }
}

function notApplicable(signal: SignalScore['signal'], weight: number): SignalScore {
  return { signal, weight, ratio: 0, applicable: false, detail: '' }
}
