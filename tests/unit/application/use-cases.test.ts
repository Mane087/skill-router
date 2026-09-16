import { createGetSkill } from '../../../src/application/get-skill.js'
import { createGetSkillReference } from '../../../src/application/get-skill-reference.js'
import { createSearchSkills } from '../../../src/application/search-skills.js'
import { createSkill } from '../../../src/domain/skill/skill.js'
import { createSkillId, formatSkillId } from '../../../src/domain/skill/skill-id.js'
import { parseSkillManifest } from '../../../src/infrastructure/manifest/manifest-schema.js'
import { InvalidSkillIdError, InvalidSkillQueryError } from '../../../src/domain/skill/errors.js'
import { SkillNotFoundError } from '../../../src/domain/errors.js'
import type { SkillContentReader } from '../../../src/application/ports/skill-content-reader.js'
import type { SkillRepository } from '../../../src/application/ports/skill-repository.js'
import type { SkillRouter } from '../../../src/router/skill-router.js'

const ANGULAR = createSkill(
  'global',
  parseSkillManifest({
    name: 'angular',
    description: 'Angular practices.',
    phases: ['implementation'],
    frameworks: ['angular'],
  }),
)

const repository: SkillRepository = {
  getById: (id) => Promise.resolve(formatSkillId(id) === 'global:angular' ? ANGULAR : null),
  list: () => Promise.resolve([ANGULAR]),
  findByPhase: () => Promise.resolve([ANGULAR]),
  findByFramework: () => Promise.resolve([ANGULAR]),
}

const reader: SkillContentReader = {
  readBody: () => Promise.resolve('# Angular'),
  listReferences: () => Promise.resolve(['component-testing']),
  readReference: (_id, reference) => Promise.resolve(`content of ${reference}`),
}

describe('searchSkills', () => {
  const router: SkillRouter = {
    search: (query) =>
      Promise.resolve([
        {
          id: createSkillId('global', 'angular'),
          scope: 'global',
          score: 0.94,
          reasons: [
            { signal: 'framework', detail: 'angular' },
            { signal: 'phase', detail: query.phase ?? 'none' },
          ],
        },
      ]),
  }

  const searchSkills = createSearchSkills(router)

  it('returns matches with their identity rendered as a string', async () => {
    const result = await searchSkills.execute({ task: 'create a component' })

    expect(result.skills[0]).toMatchObject({ id: 'global:angular', scope: 'global', score: 0.94 })
  })

  it('renders the reasons as readable sentences', async () => {
    const result = await searchSkills.execute({
      task: 'create a component',
      phase: 'implementation',
    })

    expect(result.skills[0]?.reasons).toEqual([
      'framework matched angular',
      'phase matched implementation',
    ])
  })

  it('passes the query through to the router', async () => {
    const seen: string[] = []
    const recording: SkillRouter = {
      search: (query) => {
        seen.push(query.task, String(query.limit), query.stack.join(','))
        return Promise.resolve([])
      },
    }

    await createSearchSkills(recording).execute({
      task: '  Create a Component ',
      stack: ['Angular'],
      limit: 3,
    })

    expect(seen).toEqual(['create a component', '3', 'angular'])
  })

  it('rejects an unusable query', async () => {
    await expect(searchSkills.execute({ task: '   ' })).rejects.toThrow(InvalidSkillQueryError)
  })

  it('returns an empty list rather than failing when nothing matches', async () => {
    const empty = createSearchSkills({ search: () => Promise.resolve([]) })

    await expect(empty.execute({ task: 'anything' })).resolves.toEqual({ skills: [] })
  })
})

describe('getSkill', () => {
  const getSkill = createGetSkill(repository, reader)

  it('returns the skill metadata together with its body', async () => {
    const result = await getSkill.execute({ id: 'global:angular' })

    expect(result).toEqual({
      id: 'global:angular',
      scope: 'global',
      name: 'angular',
      description: 'Angular practices.',
      body: '# Angular',
      references: ['component-testing'],
    })
  })

  it('rejects an unknown skill', async () => {
    await expect(getSkill.execute({ id: 'global:react' })).rejects.toThrow(SkillNotFoundError)
  })

  it('rejects a malformed identity before touching the repository', async () => {
    await expect(getSkill.execute({ id: 'not-an-id' })).rejects.toThrow(InvalidSkillIdError)
  })
})

describe('getSkillReference', () => {
  const getReference = createGetSkillReference(repository, reader)

  it('returns the content of the requested reference', async () => {
    const result = await getReference.execute({
      skillId: 'global:angular',
      reference: 'component-testing',
    })

    expect(result).toEqual({
      skillId: 'global:angular',
      reference: 'component-testing',
      content: 'content of component-testing',
    })
  })

  it('rejects an unknown skill', async () => {
    await expect(getReference.execute({ skillId: 'global:react', reference: 'x' })).rejects.toThrow(
      SkillNotFoundError,
    )
  })

  it('rejects a malformed identity', async () => {
    await expect(getReference.execute({ skillId: 'nope', reference: 'x' })).rejects.toThrow(
      InvalidSkillIdError,
    )
  })
})
