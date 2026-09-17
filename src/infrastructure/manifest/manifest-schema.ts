import { z } from 'zod'

import { InvalidManifestError } from '../../domain/skill/errors.js'
import { isValidSkillName } from '../../domain/skill/skill-id.js'
import { SKILL_PHASES } from '../../domain/skill/skill-manifest.js'
import type { ManifestIssue } from '../../domain/skill/errors.js'
import type { SkillManifest } from '../../domain/skill/skill-manifest.js'

/**
 * Size limits. Manifests come from user-controlled repositories, so every
 * collection and every string is bounded before anything reaches the router.
 */
const MAX_DESCRIPTION_LENGTH = 1024
const MAX_TERM_LENGTH = 64
const MAX_COLLECTION_ITEMS = 64
const MAX_FILE_PATTERN_LENGTH = 256

/** Lowercase and collapse whitespace so equivalent metadata ranks identically. */
function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Sorted with the default comparator rather than `localeCompare`: ordering must
 * not change with the host locale, or ranking stops being reproducible.
 */
function dedupeAndSort<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort()
}

const termSchema = z.string().max(MAX_TERM_LENGTH).transform(normalizeTerm)

function termCollection(): z.ZodType<string[]> {
  return z.array(termSchema).max(MAX_COLLECTION_ITEMS).default([]).transform(dedupeAndSort)
}

const phaseSchema = z
  .string()
  .max(MAX_TERM_LENGTH)
  .transform(normalizeTerm)
  .pipe(z.enum(SKILL_PHASES))

const descriptionSchema = z
  .string()
  .max(MAX_DESCRIPTION_LENGTH)
  // YAML folded scalars keep the newlines and indentation of the source file.
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Description must not be empty.'))

const nameSchema = z
  .string()
  .refine(isValidSkillName, 'Name must be lowercase kebab-case, at most 64 characters.')

const excludesSchema = z
  .strictObject({
    intents: termCollection(),
    frameworks: termCollection(),
    languages: termCollection(),
  })
  // `prefault` rather than `default`: Zod injects a default value as-is,
  // while this one is parsed through the schema like any other input.
  .prefault({ intents: [], frameworks: [], languages: [] })

const manifestSchema = z.object({
  name: nameSchema,
  version: z.int().positive().default(1),
  description: descriptionSchema,
  tags: termCollection(),
  phases: z.array(phaseSchema).max(MAX_COLLECTION_ITEMS).default([]).transform(dedupeAndSort),
  intents: termCollection(),
  languages: termCollection(),
  frameworks: termCollection(),
  // Patterns keep their original case: they are matched against real paths.
  filePatterns: z
    .array(z.string().max(MAX_FILE_PATTERN_LENGTH).trim())
    .max(MAX_COLLECTION_ITEMS)
    .default([])
    .transform(dedupeAndSort),
  related: termCollection(),
  excludes: excludesSchema,
})

const KNOWN_FIELDS: ReadonlySet<string> = new Set(Object.keys(manifestSchema.shape))

/**
 * Names the top-level frontmatter fields this schema does not know.
 *
 * Reported as a scan diagnostic rather than thrown. Phase 12 measured two real
 * catalogues where skills carry `allowed-tools`, `license` and `metadata`,
 * written by other tools that share the same file. Rejecting the document would
 * make those skills unreachable over a key the router does not even read, so
 * the field is dropped and named instead. A misspelled `framework` still
 * surfaces, as a line on stderr rather than as a rejection.
 *
 * `excludes` stays strict: nothing outside this project writes it, so an
 * unknown key there is a mistake, not somebody else's metadata.
 */
export function findUnknownManifestFields(input: unknown): readonly string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return []
  }

  return Object.keys(input)
    .filter((key) => !KNOWN_FIELDS.has(key))
    .sort()
}

/**
 * Validates and normalizes raw frontmatter into a domain manifest.
 *
 * @throws {InvalidManifestError} listing every field that failed.
 */
export function parseSkillManifest(input: unknown): SkillManifest {
  const result = manifestSchema.safeParse(input)

  if (!result.success) {
    const issues = toManifestIssues(result.error)
    throw new InvalidManifestError(describeIssues(issues), issues)
  }

  return result.data
}

function toManifestIssues(error: z.ZodError): ManifestIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }))
}

function describeIssues(issues: readonly ManifestIssue[]): string {
  const details = issues
    .map((issue) => `${issue.path.length > 0 ? issue.path : '(root)'}: ${issue.message}`)
    .join('; ')

  return `Invalid skill manifest. ${details}`
}
