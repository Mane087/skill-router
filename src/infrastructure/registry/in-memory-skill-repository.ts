import { DuplicateSkillError } from '../../domain/errors.js'
import { formatSkillId } from '../../domain/skill/skill-id.js'
import type { SkillRepository } from '../../application/ports/skill-repository.js'
import type { SkillId } from '../../domain/skill/skill-id.js'
import type { Skill } from '../../domain/skill/skill.js'
import type { SkillPhase } from '../../domain/skill/skill-manifest.js'
import type { ScannedSkill } from './skill-scanner.js'

/**
 * Builds the in-memory index the router queries.
 *
 * The plan keeps persistence out of v1 on purpose: a few hundred manifests fit
 * in memory, and a database would add operational weight with nothing to show
 * for it yet.
 *
 * @throws {DuplicateSkillError} when two entries share an identity.
 */
export function createInMemorySkillRepository(entries: readonly ScannedSkill[]): SkillRepository {
  const byId = new Map<string, Skill>()

  for (const { skill } of entries) {
    const key = formatSkillId(skill.id)

    if (byId.has(key)) {
      throw new DuplicateSkillError(`Duplicate skill identity: ${key}.`)
    }

    byId.set(key, skill)
  }

  // Sorted once at construction so every query returns a stable order.
  const ordered = [...byId.entries()]
    .sort(([left], [right]) => compare(left, right))
    .map(([, skill]) => skill)

  function filter(predicate: (skill: Skill) => boolean): Promise<Skill[]> {
    return Promise.resolve(ordered.filter(predicate))
  }

  return {
    getById(id: SkillId): Promise<Skill | null> {
      return Promise.resolve(byId.get(formatSkillId(id)) ?? null)
    },

    list(): Promise<Skill[]> {
      // A copy: callers must not be able to reorder or empty the index.
      return Promise.resolve([...ordered])
    },

    findByPhase(phase: SkillPhase): Promise<Skill[]> {
      return filter((skill) => skill.manifest.phases.includes(phase))
    },

    findByFramework(framework: string): Promise<Skill[]> {
      // Manifests are normalized at parse time; the caller's argument is not.
      const normalized = framework.trim().toLowerCase()

      return filter((skill) => skill.manifest.frameworks.includes(normalized))
    },
  }
}

function compare(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  // Plain comparison rather than localeCompare: ordering must not depend on
  // the host locale.
  return left < right ? -1 : 1
}
