import { evaluateDataset, summarize } from '../../../evals/runner/evaluate.js'
import { createSkillId } from '../../../src/domain/skill/skill-id.js'
import type { CaseOutcome, EvaluationDataset } from '../../../evals/runner/evaluate.js'
import type { SkillMatch } from '../../../src/domain/skill/skill-match.js'
import type { SkillRouter } from '../../../src/router/skill-router.js'

/** A router that always answers with the given names, in that order. */
function routerReturning(names: readonly string[]): SkillRouter {
  const matches: SkillMatch[] = names.map((name, index) => ({
    id: createSkillId('global', name),
    scope: 'global',
    score: 1 - index / 100,
    reasons: [{ signal: 'phase', detail: 'implementation' }],
  }))

  return { search: () => Promise.resolve(matches) }
}

const DATASET: EvaluationDataset = {
  name: 'sample',
  cases: [
    {
      id: 'first',
      task: 'create an angular component',
      expected: ['angular', 'jest'],
      notExpected: ['nestjs'],
    },
  ],
}

describe('evaluateDataset', () => {
  it('records what the router returned for each case', async () => {
    const report = await evaluateDataset(routerReturning(['angular', 'jest']), DATASET)

    expect(report.outcomes[0]).toMatchObject({ id: 'first', returned: ['angular', 'jest'] })
  })

  it('scores a perfect answer at the top of every metric', async () => {
    const report = await evaluateDataset(routerReturning(['angular', 'jest']), DATASET)

    expect(report.outcomes[0]).toMatchObject({
      recallAt3: 1,
      precisionAt3: 1,
      reciprocalRank: 1,
      ndcgAt5: 1,
      forbidden: 0,
      falsePositiveRate: 0,
    })
  })

  it('counts a forbidden skill that made it into the results', async () => {
    const report = await evaluateDataset(routerReturning(['angular', 'nestjs']), DATASET)

    expect(report.outcomes[0]?.forbidden).toBe(1)
  })

  it('counts anything unexpected as a false positive, forbidden or not', async () => {
    const report = await evaluateDataset(routerReturning(['angular', 'tailwind']), DATASET)

    expect(report.outcomes[0]?.falsePositiveRate).toBe(0.5)
  })

  it('handles a case the router answered with nothing', async () => {
    const report = await evaluateDataset(routerReturning([]), DATASET)

    expect(report.outcomes[0]).toMatchObject({ recallAt5: 0, falsePositiveRate: 0 })
  })

  it('carries the dataset name into the report', async () => {
    const report = await evaluateDataset(routerReturning(['angular']), DATASET)

    expect(report.name).toBe('sample')
  })
})

describe('summarize', () => {
  function outcome(overrides: Partial<CaseOutcome> = {}): CaseOutcome {
    return {
      id: 'x',
      returned: ['angular'],
      recallAt1: 1,
      recallAt3: 1,
      recallAt5: 1,
      precisionAt3: 1,
      precisionAt5: 1,
      reciprocalRank: 1,
      ndcgAt5: 1,
      forbidden: 0,
      falsePositiveRate: 0,
      ...overrides,
    }
  }

  it('averages each metric across the cases', () => {
    const summary = summarize([outcome(), outcome({ recallAt3: 0 })])

    expect(summary.recallAt3).toBe(0.5)
    expect(summary.recallAt1).toBe(1)
  })

  it('reports the share of cases that surfaced a forbidden skill', () => {
    const summary = summarize([outcome(), outcome({ forbidden: 2 }), outcome({ forbidden: 1 })])

    expect(summary.forbiddenRate).toBeCloseTo(2 / 3)
  })

  it('counts the cases it summarized', () => {
    expect(summarize([outcome(), outcome()]).cases).toBe(2)
  })

  it('returns zeroes for an empty run rather than dividing by zero', () => {
    const summary = summarize([])

    expect(summary).toMatchObject({ cases: 0, recallAt3: 0, forbiddenRate: 0 })
  })
})
