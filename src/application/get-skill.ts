import { SkillNotFoundError } from '../domain/errors.js'
import { formatSkillId, parseSkillId } from '../domain/skill/skill-id.js'
import type { SkillContentReader } from './ports/skill-content-reader.js'
import type { SkillRepository } from './ports/skill-repository.js'
import type { SkillScope } from '../domain/skill/skill-id.js'

export interface GetSkillInput {
  readonly id: string
}

export interface GetSkillResult {
  readonly id: string
  readonly scope: SkillScope
  readonly name: string
  readonly description: string
  readonly body: string
  /** Names the caller can pass to `getSkillReference`. */
  readonly references: readonly string[]
}

export interface GetSkill {
  execute(input: GetSkillInput): Promise<GetSkillResult>
}

/**
 * Returns a skill's full content, the step after the agent has chosen one from
 * a search result.
 *
 * @throws {InvalidSkillIdError} when the identity is malformed.
 * @throws {SkillNotFoundError} when no such skill is registered.
 */
export function createGetSkill(repository: SkillRepository, reader: SkillContentReader): GetSkill {
  return {
    async execute(input: GetSkillInput): Promise<GetSkillResult> {
      const id = parseSkillId(input.id)
      const skill = await repository.getById(id)

      if (skill === null) {
        throw new SkillNotFoundError(`No skill registered as ${input.id}.`)
      }

      const [body, references] = await Promise.all([reader.readBody(id), reader.listReferences(id)])

      return {
        id: formatSkillId(id),
        scope: id.scope,
        name: skill.manifest.name,
        description: skill.manifest.description,
        body,
        references,
      }
    },
  }
}
