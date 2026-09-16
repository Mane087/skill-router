/**
 * Base class for every expected failure in the domain.
 *
 * Adapters map `code` to a transport-level error, so callers never have to
 * match on message text.
 */
export abstract class SkillRouterError extends Error {
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/**
 * A path resolved outside the roots the server is allowed to read, or reached
 * through a link the policy forbids.
 */
export class UnsafePathError extends SkillRouterError {
  readonly code = 'UNSAFE_PATH'
}

/**
 * Two skills resolved to the same scope-qualified identity.
 *
 * Registration fails rather than letting one overwrite the other, so a skill
 * can never be shadowed without anybody noticing.
 */
export class DuplicateSkillError extends SkillRouterError {
  readonly code = 'DUPLICATE_SKILL'
}
