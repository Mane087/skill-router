import type { SkillId } from '../../domain/skill/skill-id.js'

/**
 * Access to a skill's content, separate from the metadata the router ranks on.
 *
 * Kept apart from `SkillRepository` on purpose: ranking must stay free of I/O,
 * while fetching a body or a reference is the step that necessarily touches
 * the filesystem.
 */
export interface SkillContentReader {
  /** The markdown body of the skill, without its frontmatter. */
  readBody(id: SkillId): Promise<string>

  /** Names of the references the skill offers, sorted. */
  listReferences(id: SkillId): Promise<readonly string[]>

  readReference(id: SkillId, reference: string): Promise<string>
}
