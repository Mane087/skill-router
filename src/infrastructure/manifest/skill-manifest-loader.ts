import { parseFrontmatter } from './frontmatter-parser.js'
import { parseSkillManifest } from './manifest-schema.js'
import type { SkillManifest } from '../../domain/skill/skill-manifest.js'

export interface LoadedSkillDocument {
  readonly manifest: SkillManifest
  /** Markdown after the frontmatter, returned to the agent by `skills.get`. */
  readonly body: string
}

/**
 * Turns the raw contents of a SKILL.md into validated metadata and its body.
 *
 * This is the only supported path from file contents to a `SkillManifest`:
 * YAML is never handed to the router untyped.
 *
 * @throws {InvalidManifestError} when the document or its metadata is invalid.
 */
export function loadSkillDocument(content: string): LoadedSkillDocument {
  const { frontmatter, body } = parseFrontmatter(content)

  return { manifest: parseSkillManifest(frontmatter), body }
}
