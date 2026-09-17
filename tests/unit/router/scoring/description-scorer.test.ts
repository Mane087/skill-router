import { scoreDescription } from '../../../../src/router/scoring/description-scorer.js'
import { createSkillQuery } from '../../../../src/domain/skill/skill-query.js'
import { createSkill } from '../../../../src/domain/skill/skill.js'
import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import type { SkillQueryInput } from '../../../../src/domain/skill/skill-query.js'

const WEIGHT = 15

function score(description: string, input: SkillQueryInput) {
  const skill = createSkill('global', parseSkillManifest({ name: 'sample', description }))

  return scoreDescription(skill, createSkillQuery(input), WEIGHT)
}

describe('scoreDescription', () => {
  it('scores the share of the query terms the description covers', () => {
    const result = score('Angular component authoring practices.', {
      task: 'create an angular component',
    })

    // "create" is the only content word the description does not carry.
    expect(result.ratio).toBeCloseTo(2 / 3)
    expect(result.detail).toBe('angular, component')
  })

  it('reports nothing when the description shares no term with the query', () => {
    const result = score('Postgres schema design.', { task: 'create an angular component' })

    expect(result).toMatchObject({ signal: 'description', ratio: 0, detail: '', applicable: true })
  })

  it('matches the explicit keywords as well as the task', () => {
    const result = score('Tailwind styling utilities.', {
      task: 'how should this be used',
      keywords: ['styling'],
    })

    expect(result).toMatchObject({ ratio: 1, detail: 'styling' })
  })

  it('ignores stop words, which every description would otherwise match', () => {
    // Only "component" carries meaning, so the ratio is 1 rather than 1/5.
    expect(score('Component authoring.', { task: 'how do I use the component' }).ratio).toBe(1)
  })

  it('ignores terms shorter than three characters', () => {
    expect(score('Component authoring.', { task: 'a component' }).ratio).toBe(1)
  })

  it('is not applicable when the query carries no term worth matching', () => {
    expect(score('Component authoring.', { task: 'do it to us' })).toMatchObject({
      applicable: false,
      ratio: 0,
    })
  })

  it('matches a term against the inflections of the same word', () => {
    const result = score('Use when creating components.', { task: 'create a component' })

    expect(result).toMatchObject({ ratio: 1, detail: 'component, create' })
  })

  it('matches a verb against the noun built from it', () => {
    expect(score('Plan the implementation.', { task: 'implement the redesign' }).detail).toBe(
      'implement',
    )
  })

  it('matches whole words only, so "test" does not match inside "latest"', () => {
    expect(score('Always use the latest release.', { task: 'write a test' }).ratio).toBe(0)
  })

  it('counts a repeated query term once', () => {
    expect(score('Component authoring.', { task: 'component component component' }).ratio).toBe(1)
  })

  it('lists the matched terms in a stable order', () => {
    const result = score('Angular component and service practices.', {
      task: 'service angular component',
    })

    expect(result.detail).toBe('angular, component, service')
  })
})
