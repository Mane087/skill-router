import { scoreMetadata } from '../../../../src/router/scoring/metadata-scorer.js'
import { DEFAULT_RANKING_WEIGHTS } from '../../../../src/router/scoring/weights.js'
import { createSkillQuery } from '../../../../src/domain/skill/skill-query.js'
import { createSkill } from '../../../../src/domain/skill/skill.js'
import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import type { RankingSignal } from '../../../../src/domain/ranking/ranking-reason.js'
import type { SkillQueryInput } from '../../../../src/domain/skill/skill-query.js'

function skill(metadata: Record<string, unknown>) {
  return createSkill(
    'global',
    parseSkillManifest({ name: 'sample', description: 'x', ...metadata }),
  )
}

function signal(metadata: Record<string, unknown>, input: SkillQueryInput, name: RankingSignal) {
  const scores = scoreMetadata(skill(metadata), createSkillQuery(input), DEFAULT_RANKING_WEIGHTS)

  return scores.find((score) => score.signal === name)
}

describe('phase signal', () => {
  it('is not applicable when the query declares no phase', () => {
    expect(signal({ phases: ['testing'] }, { task: 'x' }, 'phase')?.applicable).toBe(false)
  })

  it('scores fully when the skill declares the requested phase', () => {
    const score = signal(
      { phases: ['implementation', 'testing'] },
      { task: 'x', phase: 'implementation' },
      'phase',
    )

    expect(score).toMatchObject({ applicable: true, ratio: 1 })
  })

  it('scores zero when the skill declares other phases', () => {
    const score = signal({ phases: ['review'] }, { task: 'x', phase: 'implementation' }, 'phase')

    expect(score).toMatchObject({ applicable: true, ratio: 0 })
  })

  it('scores zero when the skill declares no phase at all', () => {
    expect(signal({}, { task: 'x', phase: 'implementation' }, 'phase')?.ratio).toBe(0)
  })
})

describe('framework and language signals', () => {
  it('are not applicable when the query declares no stack', () => {
    const score = signal({ frameworks: ['angular'] }, { task: 'x' }, 'framework')

    expect(score?.applicable).toBe(false)
  })

  it('score the share of stack terms the skill covers', () => {
    const query = { task: 'x', stack: ['angular', 'typescript'] }

    expect(signal({ frameworks: ['angular'] }, query, 'framework')?.ratio).toBe(0.5)
    expect(signal({ languages: ['typescript'] }, query, 'language')?.ratio).toBe(0.5)
  })

  it('score fully when the skill covers the whole stack', () => {
    const score = signal(
      { frameworks: ['angular', 'rxjs'] },
      { task: 'x', stack: ['angular', 'rxjs'] },
      'framework',
    )

    expect(score?.ratio).toBe(1)
  })

  it('match a stack term against languages as well as frameworks', () => {
    const query = { task: 'x', stack: ['typescript'] }

    expect(signal({ languages: ['typescript'] }, query, 'language')?.ratio).toBe(1)
    expect(signal({ frameworks: ['typescript'] }, query, 'framework')?.ratio).toBe(1)
  })

  it('names the matched terms so the result can explain itself', () => {
    const score = signal(
      { frameworks: ['angular'] },
      { task: 'x', stack: ['angular', 'typescript'] },
      'framework',
    )

    expect(score?.detail).toBe('angular')
  })
})

describe('intent signal', () => {
  it('matches an intent whose words all appear in the task', () => {
    const score = signal(
      { intents: ['create-component'] },
      { task: 'Create an Angular component for account movements' },
      'intent',
    )

    expect(score?.ratio).toBe(1)
    expect(score?.detail).toBe('create-component')
  })

  it('does not match when only some of the intent words appear', () => {
    const score = signal(
      { intents: ['create-component'] },
      { task: 'Review the component styling' },
      'intent',
    )

    expect(score?.ratio).toBe(0)
  })

  it('matches intent words coming from the keywords', () => {
    const score = signal(
      { intents: ['create-service'] },
      { task: 'work on the api', keywords: ['create', 'service'] },
      'intent',
    )

    expect(score?.ratio).toBe(1)
  })

  it('scores the share of declared intents that matched', () => {
    const score = signal(
      { intents: ['create-component', 'create-service'] },
      { task: 'create a component' },
      'intent',
    )

    expect(score?.ratio).toBe(0.5)
  })

  it('scores zero for a skill declaring no intent', () => {
    expect(signal({}, { task: 'create a component' }, 'intent')?.ratio).toBe(0)
  })

  it('matches whole words only, never a fragment of a longer one', () => {
    const score = signal({ intents: ['test'] }, { task: 'latest refactoring' }, 'intent')

    expect(score?.ratio).toBe(0)
  })
})

describe('file signal', () => {
  it('is not applicable when the query names no file', () => {
    const score = signal({ filePatterns: ['**/*.ts'] }, { task: 'x' }, 'file')

    expect(score?.applicable).toBe(false)
  })

  it('scores the share of query files the patterns cover', () => {
    const score = signal(
      { filePatterns: ['**/*.component.ts'] },
      { task: 'x', files: ['src/a.component.ts', 'src/b.service.ts'] },
      'file',
    )

    expect(score?.ratio).toBe(0.5)
  })

  it('scores fully when every file matches', () => {
    const score = signal(
      { filePatterns: ['**/*.component.ts', '**/*.spec.ts'] },
      { task: 'x', files: ['a.component.ts', 'a.spec.ts'] },
      'file',
    )

    expect(score?.ratio).toBe(1)
  })

  it('scores zero for a skill declaring no pattern', () => {
    expect(signal({}, { task: 'x', files: ['a.ts'] }, 'file')?.ratio).toBe(0)
  })

  it('names the pattern that matched', () => {
    const score = signal(
      { filePatterns: ['**/*.component.ts'] },
      { task: 'x', files: ['src/a.component.ts'] },
      'file',
    )

    expect(score?.detail).toBe('**/*.component.ts')
  })
})

describe('signal weights', () => {
  it('reports the configured weight of each signal', () => {
    const scores = scoreMetadata(
      skill({ phases: ['implementation'] }),
      createSkillQuery({ task: 'x', phase: 'implementation' }),
      DEFAULT_RANKING_WEIGHTS,
    )

    expect(scores.find((score) => score.signal === 'phase')?.weight).toBe(
      DEFAULT_RANKING_WEIGHTS.phase,
    )
  })

  it('ranks phase above framework, and framework above intent', () => {
    expect(DEFAULT_RANKING_WEIGHTS.phase).toBeGreaterThan(DEFAULT_RANKING_WEIGHTS.framework)
    expect(DEFAULT_RANKING_WEIGHTS.framework).toBeGreaterThan(DEFAULT_RANKING_WEIGHTS.intent)
    expect(DEFAULT_RANKING_WEIGHTS.intent).toBeGreaterThan(DEFAULT_RANKING_WEIGHTS.file)
  })
})
