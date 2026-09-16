import { scoreLexical } from '../../../../src/router/scoring/lexical-scorer.js'
import { createSkillQuery } from '../../../../src/domain/skill/skill-query.js'
import { createSkill } from '../../../../src/domain/skill/skill.js'
import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import type { SkillQueryInput } from '../../../../src/domain/skill/skill-query.js'

const WEIGHT = 10

function score(tags: readonly string[], input: SkillQueryInput) {
  const skill = createSkill(
    'global',
    parseSkillManifest({ name: 'sample', description: 'x', tags }),
  )

  return scoreLexical(skill, createSkillQuery(input), WEIGHT)
}

describe('scoreLexical', () => {
  it('stays applicable even when the query declares no keyword', () => {
    expect(score(['component'], { task: 'build a component' }).applicable).toBe(true)
  })

  it('matches tags against the words of the task', () => {
    const result = score(['component'], { task: 'create an angular component' })

    expect(result).toMatchObject({ ratio: 1, detail: 'component' })
  })

  it('matches tags against the explicit keywords too', () => {
    expect(score(['styling'], { task: 'do the work', keywords: ['styling'] }).ratio).toBe(1)
  })

  it('scores the share of the skill tags that appear in the query', () => {
    const result = score(['angular', 'frontend', 'component'], {
      task: 'create an angular component',
    })

    expect(result.ratio).toBeCloseTo(2 / 3)
    expect(result.detail).toBe('angular, component')
  })

  it('rewards a focused skill over one burying the same tag among many', () => {
    const focused = score(['testing'], { task: 'testing work' })
    const diluted = score(['testing', 'a', 'b', 'c'], { task: 'testing work' })

    expect(focused.ratio).toBeGreaterThan(diluted.ratio)
  })

  it('scores zero when no tag appears', () => {
    expect(score(['backend'], { task: 'create an angular component' }).ratio).toBe(0)
  })

  it('scores zero for a skill declaring no tag', () => {
    expect(score([], { task: 'create an angular component' })).toMatchObject({
      ratio: 0,
      applicable: true,
      detail: '',
    })
  })

  it('matches whole words only, never a fragment of a longer one', () => {
    expect(score(['test'], { task: 'the latest change' }).ratio).toBe(0)
  })

  it('does not match a plural against its singular, since there is no stemming', () => {
    expect(score(['testing'], { task: 'write unit tests' }).ratio).toBe(0)
  })

  it('reports the weight it was given', () => {
    expect(score(['component'], { task: 'a component' }).weight).toBe(WEIGHT)
  })
})
