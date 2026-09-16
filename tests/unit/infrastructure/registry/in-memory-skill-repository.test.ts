import { createInMemorySkillRepository } from '../../../../src/infrastructure/registry/in-memory-skill-repository.js'
import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import { createSkill } from '../../../../src/domain/skill/skill.js'
import { createSkillId, formatSkillId } from '../../../../src/domain/skill/skill-id.js'
import type { SkillScope } from '../../../../src/domain/skill/skill-id.js'
import type { ScannedSkill } from '../../../../src/infrastructure/registry/skill-scanner.js'
import { DuplicateSkillError } from '../../../../src/domain/errors.js'

function entry(
  scope: SkillScope,
  name: string,
  metadata: Record<string, unknown> = {},
): ScannedSkill {
  const manifest = parseSkillManifest({ name, description: `Skill ${name}.`, ...metadata })

  return { skill: createSkill(scope, manifest), directory: `/roots/${scope}/${name}` }
}

const ENTRIES = [
  entry('global', 'angular', {
    phases: ['implementation', 'testing'],
    frameworks: ['angular'],
  }),
  entry('global', 'jest', { phases: ['testing'], frameworks: ['jest'] }),
  entry('global', 'architecture-planning', { phases: ['planning'] }),
  entry('project', 'angular', { phases: ['implementation'], frameworks: ['angular'] }),
]

const repository = createInMemorySkillRepository(ENTRIES)

describe('getById', () => {
  it('returns the skill registered under that identity', async () => {
    const skill = await repository.getById(createSkillId('global', 'angular'))

    expect(skill?.manifest.name).toBe('angular')
    expect(skill?.id.scope).toBe('global')
  })

  it('distinguishes the same name across scopes', async () => {
    const globalSkill = await repository.getById(createSkillId('global', 'angular'))
    const projectSkill = await repository.getById(createSkillId('project', 'angular'))

    expect(globalSkill?.manifest.phases).toEqual(['implementation', 'testing'])
    expect(projectSkill?.manifest.phases).toEqual(['implementation'])
  })

  it('returns null for an unknown skill', async () => {
    await expect(repository.getById(createSkillId('global', 'svelte'))).resolves.toBeNull()
  })

  it('returns null when only another scope declares the skill', async () => {
    await expect(repository.getById(createSkillId('project', 'jest'))).resolves.toBeNull()
  })
})

describe('list', () => {
  it('returns every skill in a deterministic order', async () => {
    const ids = (await repository.list()).map((skill) => formatSkillId(skill.id))

    expect(ids).toEqual([
      'global:angular',
      'global:architecture-planning',
      'global:jest',
      'project:angular',
    ])
  })

  it('returns an empty list for an empty registry', async () => {
    await expect(createInMemorySkillRepository([]).list()).resolves.toEqual([])
  })
})

describe('findByPhase', () => {
  it('returns only the skills declaring that phase', async () => {
    const ids = (await repository.findByPhase('testing')).map((skill) => formatSkillId(skill.id))

    expect(ids).toEqual(['global:angular', 'global:jest'])
  })

  it('returns an empty list when no skill declares the phase', async () => {
    await expect(repository.findByPhase('review')).resolves.toEqual([])
  })
})

describe('findByFramework', () => {
  it('returns only the skills declaring that framework', async () => {
    const ids = (await repository.findByFramework('angular')).map((skill) =>
      formatSkillId(skill.id),
    )

    expect(ids).toEqual(['global:angular', 'project:angular'])
  })

  it('matches regardless of the case used by the caller', async () => {
    await expect(repository.findByFramework('  ANGULAR ')).resolves.toHaveLength(2)
  })

  it('returns an empty list for an unknown framework', async () => {
    await expect(repository.findByFramework('svelte')).resolves.toEqual([])
  })
})

describe('registry construction', () => {
  it('refuses duplicate identities rather than letting one overwrite the other', () => {
    const duplicated = [entry('global', 'angular'), entry('global', 'angular')]

    expect(() => createInMemorySkillRepository(duplicated)).toThrow(DuplicateSkillError)
  })

  it('names the conflicting identity', () => {
    const duplicated = [entry('global', 'angular'), entry('global', 'angular')]

    expect(() => createInMemorySkillRepository(duplicated)).toThrow(/global:angular/)
  })

  it('accepts the same name in different scopes', () => {
    expect(() =>
      createInMemorySkillRepository([entry('global', 'angular'), entry('project', 'angular')]),
    ).not.toThrow()
  })
})
