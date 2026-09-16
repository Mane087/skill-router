/**
 * Lifecycle phases a skill can declare.
 *
 * Deliberately a closed set: phase carries the highest weight in the scoring
 * model, so an open string would let a typo such as "implementaion" silently
 * remove a skill from every implementation query.
 */
export const SKILL_PHASES = ['planning', 'implementation', 'testing', 'review'] as const

export type SkillPhase = (typeof SKILL_PHASES)[number]

/**
 * Negative metadata, used to cut false positives.
 *
 * A match here is a hard negative in the router rather than a lower score:
 * an Angular skill must not surface on a React task just because both are
 * tagged "frontend".
 */
export interface SkillExclusions {
  readonly intents: readonly string[]
  readonly frameworks: readonly string[]
  readonly languages: readonly string[]
}

/**
 * Validated, normalized metadata of a skill.
 *
 * Every collection arrives lowercased, de-duplicated and sorted, so the same
 * metadata written in a different case or order always ranks identically.
 * `filePatterns` is the exception: it keeps its original case because it is
 * matched against real paths.
 */
export interface SkillManifest {
  readonly name: string
  readonly version: number
  readonly description: string
  readonly tags: readonly string[]
  readonly phases: readonly SkillPhase[]
  readonly intents: readonly string[]
  readonly languages: readonly string[]
  readonly frameworks: readonly string[]
  readonly filePatterns: readonly string[]
  readonly related: readonly string[]
  readonly excludes: SkillExclusions
}
