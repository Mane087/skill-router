import { parseDocument } from 'yaml'

import { InvalidManifestError } from '../../domain/skill/errors.js'
import type { ManifestIssue } from '../../domain/skill/errors.js'

/** Matches the plan's `maxSkillSizeKb` default (section 25). */
const MAX_DOCUMENT_BYTES = 256 * 1024
const MAX_FRONTMATTER_BYTES = 16 * 1024

/** Bounds recursion while validating, and rejects absurdly nested metadata. */
const MAX_DEPTH = 8

/** Caps anchor expansion, which is the usual YAML denial-of-service vector. */
const MAX_ALIAS_COUNT = 100

/**
 * Leading `---` line, the smallest possible YAML block, then a closing `---`.
 * The lazy quantifier stops at the first closing delimiter, so a horizontal
 * rule further down stays part of the body.
 */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/

const BYTE_ORDER_MARK = '﻿'

export interface SkillDocument {
  /** Raw YAML mapping. Still unknown: shape is decided by the manifest schema. */
  readonly frontmatter: unknown
  readonly body: string
}

/**
 * Splits a SKILL.md into its YAML frontmatter and markdown body.
 *
 * The YAML is parsed with a strict core schema and then checked to contain only
 * JSON-compatible values. Without that second pass, tags such as `!!binary`
 * resolve to a Node `Buffer` and reach the manifest schema as an object no
 * validator expects.
 *
 * @throws {InvalidManifestError} when the document or its YAML is unusable.
 */
export function parseFrontmatter(content: string): SkillDocument {
  const documentBytes = Buffer.byteLength(content, 'utf8')

  if (documentBytes > MAX_DOCUMENT_BYTES) {
    throw fail('(document)', `Skill document exceeds ${describeKb(MAX_DOCUMENT_BYTES)}.`)
  }

  const normalized = content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content
  const match = FRONTMATTER_PATTERN.exec(normalized)

  if (match === null) {
    throw fail(
      '(document)',
      'Skill document must start with a YAML frontmatter block delimited by "---" lines.',
    )
  }

  const [block, yamlText = ''] = match

  if (Buffer.byteLength(yamlText, 'utf8') > MAX_FRONTMATTER_BYTES) {
    throw fail('(frontmatter)', `Frontmatter exceeds ${describeKb(MAX_FRONTMATTER_BYTES)}.`)
  }

  return {
    frontmatter: parseYamlMapping(yamlText),
    body: normalized.slice(block.length),
  }
}

function parseYamlMapping(yamlText: string): Record<string, unknown> {
  const document = parseDocument(yamlText, {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
    strict: true,
    prettyErrors: false,
  })

  if (document.errors.length > 0) {
    throw new InvalidManifestError(
      `Invalid frontmatter YAML. ${document.errors.map((error) => error.message).join('; ')}`,
      document.errors.map((error) => ({ path: '(frontmatter)', message: error.message })),
    )
  }

  // A warning here means a tag the core schema could not resolve. `yaml` falls
  // back to the plain value, which would silently accept `name: !custom x`.
  if (document.warnings.length > 0) {
    throw new InvalidManifestError(
      `Unsupported YAML tag in frontmatter. ${document.warnings.map((warning) => warning.message).join('; ')}`,
      document.warnings.map((warning) => ({ path: '(frontmatter)', message: warning.message })),
    )
  }

  const value = toPlainValue(document)

  if (!isPlainObject(value)) {
    throw fail('(frontmatter)', 'Frontmatter must be a YAML mapping of fields.')
  }

  const issues: ManifestIssue[] = []
  collectNonJsonValues(value, '', 0, issues)

  if (issues.length > 0) {
    throw new InvalidManifestError(
      `Frontmatter contains unsupported values. ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
      issues,
    )
  }

  return value
}

function toPlainValue(document: ReturnType<typeof parseDocument>): unknown {
  try {
    // `maxAliasCount` belongs to `toJS`, not to the parser: anchors are only
    // expanded when the document is converted to plain values.
    return document.toJS({ maxAliasCount: MAX_ALIAS_COUNT })
  } catch (error) {
    // Thrown when anchor expansion exceeds `maxAliasCount`.
    throw fail('(frontmatter)', `Frontmatter could not be expanded: ${describeError(error)}`)
  }
}

function collectNonJsonValues(
  value: unknown,
  path: string,
  depth: number,
  issues: ManifestIssue[],
): void {
  if (depth > MAX_DEPTH) {
    issues.push({
      path: path === '' ? '(frontmatter)' : path,
      message: `Nested beyond the maximum depth of ${String(MAX_DEPTH)}.`,
    })
    return
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      issues.push({ path, message: 'Numbers must be finite.' })
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNonJsonValues(item, joinPath(path, String(index)), depth + 1, issues)
    })
    return
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      collectNonJsonValues(nested, joinPath(path, key), depth + 1, issues)
    }
    return
  }

  issues.push({
    path: path === '' ? '(frontmatter)' : path,
    message: 'Only strings, numbers, booleans, lists and mappings are supported.',
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype: unknown = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function joinPath(parent: string, segment: string): string {
  return parent === '' ? segment : `${parent}.${segment}`
}

function describeKb(bytes: number): string {
  return `${String(bytes / 1024)} KB`
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function fail(path: string, message: string): InvalidManifestError {
  return new InvalidManifestError(`Invalid skill document. ${path}: ${message}`, [
    { path, message },
  ])
}
