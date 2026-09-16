import { SkillNotFoundError } from '../domain/errors.js'
import { formatSkillId, parseSkillId } from '../domain/skill/skill-id.js'
import type { SkillContentReader } from './ports/skill-content-reader.js'
import type { SkillRepository } from './ports/skill-repository.js'

export interface GetSkillReferenceInput {
  readonly skillId: string
  readonly reference: string
}

export interface GetSkillReferenceResult {
  readonly skillId: string
  readonly reference: string
  readonly content: string
}

export interface GetSkillReference {
  execute(input: GetSkillReferenceInput): Promise<GetSkillReferenceResult>
}

/**
 * Returns one reference of a skill, the last and narrowest step of the
 * disclosure chain: search, then the skill, then only the reference needed.
 *
 * @throws {InvalidSkillIdError} when the identity is malformed.
 * @throws {SkillNotFoundError} when no such skill is registered.
 * @throws {ReferenceNotFoundError} when the skill has no such reference.
 * @throws {UnsafePathError} when the reference name is not a plain name.
 */
export function createGetSkillReference(
  repository: SkillRepository,
  reader: SkillContentReader,
): GetSkillReference {
  return {
    async execute(input: GetSkillReferenceInput): Promise<GetSkillReferenceResult> {
      const id = parseSkillId(input.skillId)

      if ((await repository.getById(id)) === null) {
        throw new SkillNotFoundError(`No skill registered as ${input.skillId}.`)
      }

      return {
        skillId: formatSkillId(id),
        reference: input.reference,
        content: await reader.readReference(id, input.reference),
      }
    },
  }
}
