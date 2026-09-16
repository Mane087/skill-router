import { createSkillRouter } from '../../../src/router/skill-router.js'
import { createSkillQuery } from '../../../src/domain/skill/skill-query.js'
import { createSkill } from '../../../src/domain/skill/skill.js'
import { formatSkillId } from '../../../src/domain/skill/skill-id.js'
import { formatRankingReason } from '../../../src/domain/ranking/ranking-reason.js'
import { parseSkillManifest } from '../../../src/infrastructure/manifest/manifest-schema.js'
import type { SkillRepository } from '../../../src/application/ports/skill-repository.js'
import type { SkillQueryInput } from '../../../src/domain/skill/skill-query.js'
import type { SkillScope } from '../../../src/domain/skill/skill-id.js'
import type { Skill } from '../../../src/domain/skill/skill.js'

function skill(name: string, metadata: Record<string, unknown> = {}, scope: SkillScope = 'global') {
  return createSkill(
    scope,
    parseSkillManifest({ name, description: `Skill ${name}.`, ...metadata }),
  )
}

/**
 * A stub of the port, not the real registry: the router must work without a
 * filesystem, which is the exit criterion of this phase.
 */
function repositoryOf(skills: readonly Skill[]): SkillRepository {
  return {
    getById: (id) =>
      Promise.resolve(
        skills.find((candidate) => formatSkillId(candidate.id) === formatSkillId(id)) ?? null,
      ),
    list: () => Promise.resolve([...skills]),
    findByPhase: (phase) =>
      Promise.resolve(skills.filter((candidate) => candidate.manifest.phases.includes(phase))),
    findByFramework: (framework) =>
      Promise.resolve(
        skills.filter((candidate) => candidate.manifest.frameworks.includes(framework)),
      ),
  }
}

function search(skills: readonly Skill[], input: SkillQueryInput) {
  return createSkillRouter(repositoryOf(skills)).search(createSkillQuery(input))
}

const ANGULAR = skill('angular', {
  phases: ['planning', 'implementation', 'testing', 'review'],
  frameworks: ['angular'],
  languages: ['typescript'],
  intents: ['create-component', 'modify-component', 'create-service'],
  filePatterns: ['**/*.component.ts', '**/*.component.html', '**/*.spec.ts'],
  tags: ['angular', 'frontend', 'component'],
  related: ['typescript', 'jest'],
  excludes: { frameworks: ['react', 'vue'] },
})

const JEST = skill('jest', {
  phases: ['implementation', 'testing'],
  frameworks: ['jest'],
  intents: ['write-test', 'run-test'],
  filePatterns: ['**/*.spec.ts', '**/*.test.ts'],
  tags: ['testing', 'unit', 'assertions'],
})

const TYPESCRIPT = skill('typescript', {
  phases: ['implementation'],
  languages: ['typescript'],
  filePatterns: ['**/*.ts'],
  tags: ['typescript'],
})

const NESTJS = skill('nestjs', {
  phases: ['implementation'],
  frameworks: ['nestjs'],
  languages: ['typescript'],
  tags: ['backend'],
})

const CATALOG = [ANGULAR, JEST, TYPESCRIPT, NESTJS]

describe('search', () => {
  it('ranks the skill matching most of the query first', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
    })

    expect(formatSkillId(matches[0]!.id)).toBe('global:angular')
  })

  it('returns no more results than the requested limit', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      limit: 2,
    })

    expect(matches).toHaveLength(2)
  })

  it('drops skills that match nothing the query asked for', async () => {
    const matches = await search(CATALOG, { task: 'rename a variable', phase: 'review' })
    const names = matches.map((match) => match.id.name)

    expect(names).not.toContain('nestjs')
  })

  it('returns an empty list when nothing is relevant', async () => {
    const matches = await search([NESTJS], { task: 'write documentation', phase: 'review' })

    expect(matches).toEqual([])
  })

  it('scores every result between 0 and 1', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts', 'users.component.spec.ts'],
    })

    for (const match of matches) {
      expect(match.score).toBeGreaterThan(0)
      expect(match.score).toBeLessThanOrEqual(1)
    }
  })

  it('orders results by descending score', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts', 'users.component.spec.ts'],
    })

    const scores = matches.map((match) => match.score)

    expect([...scores].sort((left, right) => right - left)).toEqual(scores)
  })

  it('reports the scope alongside the identity', async () => {
    const matches = await search([skill('house-style', { phases: ['review'] }, 'project')], {
      task: 'review the branch',
      phase: 'review',
    })

    expect(matches[0]?.scope).toBe('project')
  })
})

describe('search determinism', () => {
  it('returns identical results for identical queries', async () => {
    const input = {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts'],
    } as const

    expect(await search(CATALOG, input)).toEqual(await search(CATALOG, input))
  })

  it('does not depend on the order skills come back from the repository', async () => {
    const input = {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular'],
    } as const

    const forwards = await search(CATALOG, input)
    const backwards = await search([...CATALOG].reverse(), input)

    expect(backwards).toEqual(forwards)
  })

  it('breaks ties by identity so equal scores keep a stable order', async () => {
    const left = skill('alpha', { phases: ['review'] })
    const right = skill('beta', { phases: ['review'] })

    const matches = await search([right, left], { task: 'review it', phase: 'review' })

    expect(matches.map((match) => match.id.name)).toEqual(['alpha', 'beta'])
  })
})

describe('search exclusions', () => {
  it('removes a skill whose negative metadata matches the query', async () => {
    const matches = await search(CATALOG, {
      task: 'create a react component',
      phase: 'implementation',
      stack: ['react'],
    })

    expect(matches.map((match) => match.id.name)).not.toContain('angular')
  })

  it('keeps the skill when the exclusion does not apply', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular'],
    })

    expect(matches.map((match) => match.id.name)).toContain('angular')
  })
})

describe('search explanations', () => {
  it('explains every result', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts'],
    })

    for (const match of matches) {
      expect(match.reasons.length).toBeGreaterThan(0)
    }
  })

  it('names the signals that made the top result win', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts'],
    })

    const reasons = matches[0]!.reasons.map(formatRankingReason)

    expect(reasons).toEqual(
      expect.arrayContaining([
        'phase matched implementation',
        'framework matched angular',
        'file pattern matched **/*.component.ts',
      ]),
    )
  })

  it('never reports a signal that did not contribute', async () => {
    const matches = await search([TYPESCRIPT], {
      task: 'write some code',
      phase: 'implementation',
    })

    expect(matches[0]!.reasons.map((reason) => reason.signal)).not.toContain('framework')
  })
})

describe('related boost', () => {
  it('lifts a skill declared as related by another candidate', async () => {
    const input = {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.spec.ts'],
    } as const

    const withAngular = await search([ANGULAR, JEST], input)
    const withoutAngular = await search([JEST], input)

    const boosted = withAngular.find((match) => match.id.name === 'jest')?.score ?? 0
    const plain = withoutAngular.find((match) => match.id.name === 'jest')?.score ?? 0

    expect(boosted).toBeGreaterThan(plain)
  })

  it('explains the boost by naming the skill that declared the relation', async () => {
    const matches = await search([ANGULAR, JEST], {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular'],
      files: ['users.component.spec.ts'],
    })

    const reasons = matches.find((match) => match.id.name === 'jest')?.reasons ?? []

    expect(reasons.map(formatRankingReason)).toContain('related skill matched angular')
  })

  it('does not admit a skill that matches nothing on its own', async () => {
    const orphan = skill('orphan')
    const parent = skill('parent', { phases: ['review'], related: ['orphan'] })

    const matches = await search([parent, orphan], { task: 'review it', phase: 'review' })

    expect(matches.map((match) => match.id.name)).not.toContain('orphan')
  })
})

describe('milestone 1 scenario', () => {
  it('selects the expected skills for an Angular component task', async () => {
    const matches = await search(CATALOG, {
      task: 'create an angular component and its unit tests',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['users.component.ts', 'users.component.spec.ts'],
      limit: 3,
    })

    const names = matches.map((match) => match.id.name)

    expect(names[0]).toBe('angular')
    expect(names).toContain('jest')
    expect(names).toContain('typescript')
    expect(names).not.toContain('nestjs')
  })
})
