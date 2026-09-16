import { InvalidSkillIdError } from './errors.js'

export const SKILL_SCOPES = ['global', 'project'] as const

export type SkillScope = (typeof SKILL_SCOPES)[number]

/**
 * Scope-qualified identity of a skill.
 *
 * Scope is part of the identity on purpose: `global:angular` and
 * `project:angular` are two different skills, so a project skill can never
 * silently shadow a global one (architecture rule 6).
 */
export interface SkillId {
  readonly scope: SkillScope
  readonly name: string
}

/**
 * Names end up in filesystem lookups, so the accepted shape is deliberately
 * narrow: lowercase kebab-case only. That excludes path separators, traversal
 * segments and control characters before any path is ever built.
 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const MAX_SKILL_NAME_LENGTH = 64

const SCOPE_SEPARATOR = ':'

/**
 * Predicate form of the name rules, for validators that report issues instead
 * of throwing.
 */
export function isValidSkillName(name: string): boolean {
  return !exceedsMaxNameLength(name) && SKILL_NAME_PATTERN.test(name)
}

export function createSkillId(scope: SkillScope, name: string): SkillId {
  if (exceedsMaxNameLength(name)) {
    throw new InvalidSkillIdError(
      `Skill name exceeds ${String(MAX_SKILL_NAME_LENGTH)} characters: received ${String(name.length)}.`,
    )
  }

  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new InvalidSkillIdError(
      `Skill name must be lowercase kebab-case (for example "architecture-planning"): received ${JSON.stringify(name)}.`,
    )
  }

  return { scope, name }
}

export function formatSkillId(id: SkillId): string {
  return `${id.scope}${SCOPE_SEPARATOR}${id.name}`
}

export function parseSkillId(value: string): SkillId {
  const separatorIndex = value.indexOf(SCOPE_SEPARATOR)

  if (separatorIndex === -1) {
    throw new InvalidSkillIdError(
      `Skill id must be "<scope>${SCOPE_SEPARATOR}<name>": received ${JSON.stringify(value)}.`,
    )
  }

  const scope = value.slice(0, separatorIndex)
  const name = value.slice(separatorIndex + SCOPE_SEPARATOR.length)

  if (!isSkillScope(scope)) {
    throw new InvalidSkillIdError(
      `Unknown skill scope ${JSON.stringify(scope)}: expected one of ${SKILL_SCOPES.join(', ')}.`,
    )
  }

  return createSkillId(scope, name)
}

export function skillIdEquals(left: SkillId, right: SkillId): boolean {
  return left.scope === right.scope && left.name === right.name
}

function isSkillScope(value: string): value is SkillScope {
  return (SKILL_SCOPES as readonly string[]).includes(value)
}

function exceedsMaxNameLength(name: string): boolean {
  return name.length > MAX_SKILL_NAME_LENGTH
}
