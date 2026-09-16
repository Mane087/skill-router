import { createSkillId } from './skill-id.js'
import type { SkillId, SkillScope } from './skill-id.js'
import type { SkillManifest } from './skill-manifest.js'

/**
 * A skill as the router sees it: an identity plus validated metadata.
 *
 * Where the skill lives on disk and how much it can be trusted belong to the
 * registry, not here, so the router stays testable without a filesystem.
 */
export interface Skill {
  readonly id: SkillId
  readonly manifest: SkillManifest
}

export function createSkill(scope: SkillScope, manifest: SkillManifest): Skill {
  return { id: createSkillId(scope, manifest.name), manifest }
}
