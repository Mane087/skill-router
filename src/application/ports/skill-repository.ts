import type { SkillId } from '../../domain/skill/skill-id.js'
import type { Skill } from '../../domain/skill/skill.js'
import type { SkillPhase } from '../../domain/skill/skill-manifest.js'

/**
 * Read access to the indexed skills.
 *
 * The router depends on this port, never on the filesystem, which is what keeps
 * ranking testable without any I/O.
 */
export interface SkillRepository {
  getById(id: SkillId): Promise<Skill | null>
  list(): Promise<Skill[]>
  findByPhase(phase: SkillPhase): Promise<Skill[]>
  findByFramework(framework: string): Promise<Skill[]>
}
