import { findExclusion } from '../../../../src/router/filters/exclusion-filter.js'
import { createSkillQuery } from '../../../../src/domain/skill/skill-query.js'
import { createSkill } from '../../../../src/domain/skill/skill.js'
import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import type { SkillQueryInput } from '../../../../src/domain/skill/skill-query.js'

function exclusion(metadata: Record<string, unknown>, input: SkillQueryInput) {
  const skill = createSkill(
    'global',
    parseSkillManifest({ name: 'angular', description: 'x', ...metadata }),
  )

  return findExclusion(skill, createSkillQuery(input))
}

describe('findExclusion', () => {
  it('returns null when the skill excludes nothing', () => {
    expect(exclusion({}, { task: 'build a react app', stack: ['react'] })).toBeNull()
  })

  it('returns null when the exclusions do not apply to the query', () => {
    const result = exclusion(
      { excludes: { frameworks: ['react'] } },
      { task: 'build it', stack: ['angular'] },
    )

    expect(result).toBeNull()
  })

  it('excludes a skill whose excluded framework is in the stack', () => {
    const result = exclusion(
      { excludes: { frameworks: ['react', 'vue'] } },
      { task: 'build it', stack: ['react', 'typescript'] },
    )

    expect(result).toMatchObject({ signal: 'framework', detail: 'react' })
  })

  it('excludes a skill whose excluded language is in the stack', () => {
    const result = exclusion(
      { excludes: { languages: ['python'] } },
      { task: 'build it', stack: ['python'] },
    )

    expect(result).toMatchObject({ signal: 'language', detail: 'python' })
  })

  it('excludes a skill whose excluded intent appears in the task', () => {
    const result = exclusion(
      { excludes: { intents: ['backend-only'] } },
      { task: 'a backend only change' },
    )

    expect(result).toMatchObject({ signal: 'intent', detail: 'backend-only' })
  })

  it('does not exclude on an intent whose words only partly appear', () => {
    expect(
      exclusion({ excludes: { intents: ['backend-only'] } }, { task: 'a backend change' }),
    ).toBeNull()
  })

  it('matches excluded intent words coming from the keywords', () => {
    const result = exclusion(
      { excludes: { intents: ['backend-only'] } },
      { task: 'change it', keywords: ['backend', 'only'] },
    )

    expect(result).not.toBeNull()
  })

  it('reports the first exclusion deterministically when several apply', () => {
    const query = { task: 'a backend only change', stack: ['react'] }
    const metadata = {
      excludes: { frameworks: ['react'], intents: ['backend-only'] },
    }

    expect(exclusion(metadata, query)).toEqual(exclusion(metadata, query))
  })
})
