import { SkillRouterError } from '../errors.js'

export class InvalidSkillIdError extends SkillRouterError {
  readonly code = 'INVALID_SKILL_ID'
}

/** A single rejected field, addressed by its dotted path within the manifest. */
export interface ManifestIssue {
  readonly path: string
  readonly message: string
}

export class InvalidManifestError extends SkillRouterError {
  readonly code = 'INVALID_MANIFEST'

  /**
   * Every failing field, not just the first one, so a skill author can fix a
   * manifest in one pass.
   */
  readonly issues: readonly ManifestIssue[]

  constructor(message: string, issues: readonly ManifestIssue[]) {
    super(message)
    this.issues = issues
  }
}

export class InvalidSkillQueryError extends SkillRouterError {
  readonly code = 'INVALID_SKILL_QUERY'
}
