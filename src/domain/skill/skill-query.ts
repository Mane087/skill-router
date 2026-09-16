import { InvalidSkillQueryError } from './errors.js'
import type { SkillPhase } from './skill-manifest.js'

export const DEFAULT_SEARCH_LIMIT = 5
export const MAX_SEARCH_LIMIT = 10

const MAX_TASK_LENGTH = 4096
const MAX_TERM_LENGTH = 256
const MAX_COLLECTION_ITEMS = 64

export interface SkillQueryInput {
  readonly task: string
  readonly phase?: SkillPhase | null
  readonly stack?: readonly string[]
  readonly files?: readonly string[]
  readonly keywords?: readonly string[]
  readonly limit?: number
}

/**
 * A normalized search request.
 *
 * `stack` deliberately mixes languages and frameworks: the calling agent has no
 * reason to know whether "typescript" is one or the other, so the router
 * matches every stack term against both.
 */
export interface SkillQuery {
  readonly task: string
  readonly phase: SkillPhase | null
  readonly stack: readonly string[]
  readonly files: readonly string[]
  readonly keywords: readonly string[]
  readonly limit: number
}

/**
 * Validates and normalizes a search request.
 *
 * Normalization mirrors the manifest rules, so a query and a manifest written
 * in different cases still match.
 *
 * @throws {InvalidSkillQueryError} when the request cannot be satisfied.
 */
export function createSkillQuery(input: SkillQueryInput): SkillQuery {
  return {
    task: normalizeTask(input.task),
    phase: input.phase ?? null,
    stack: normalizeTerms(input.stack ?? [], 'stack'),
    files: normalizePaths(input.files ?? [], 'files'),
    keywords: normalizeTerms(input.keywords ?? [], 'keywords'),
    limit: normalizeLimit(input.limit),
  }
}

function normalizeTask(task: string): string {
  if (task.length > MAX_TASK_LENGTH) {
    throw new InvalidSkillQueryError(
      `Task exceeds ${String(MAX_TASK_LENGTH)} characters: received ${String(task.length)}.`,
    )
  }

  const normalized = task.trim().toLowerCase().replace(/\s+/g, ' ')

  if (normalized.length === 0) {
    throw new InvalidSkillQueryError('Task must not be empty: it is the primary ranking signal.')
  }

  return normalized
}

function normalizeTerms(values: readonly string[], field: string): string[] {
  assertWithinLimits(values, field)

  return dedupeAndSort(values.map((value) => value.trim().toLowerCase().replace(/\s+/g, ' ')))
}

/** Paths keep their case: they are matched against glob patterns. */
function normalizePaths(values: readonly string[], field: string): string[] {
  assertWithinLimits(values, field)

  return dedupeAndSort(values.map((value) => value.trim()))
}

function assertWithinLimits(values: readonly string[], field: string): void {
  if (values.length > MAX_COLLECTION_ITEMS) {
    throw new InvalidSkillQueryError(
      `Field "${field}" exceeds ${String(MAX_COLLECTION_ITEMS)} entries: received ${String(values.length)}.`,
    )
  }

  for (const value of values) {
    if (value.length > MAX_TERM_LENGTH) {
      throw new InvalidSkillQueryError(
        `An entry in "${field}" exceeds ${String(MAX_TERM_LENGTH)} characters.`,
      )
    }
  }
}

function dedupeAndSort(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort()
}

/**
 * A limit above the maximum is capped rather than rejected: asking for more
 * results than the server will return is a reasonable request, while asking
 * for none or for a fraction of a result is not.
 */
function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_SEARCH_LIMIT
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidSkillQueryError(`Limit must be a positive integer: received ${String(limit)}.`)
  }

  return Math.min(limit, MAX_SEARCH_LIMIT)
}
