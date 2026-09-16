import {
  countForbidden,
  falsePositiveRate,
  ndcgAt,
  precisionAt,
  recallAt,
  reciprocalRank,
} from '../../../evals/runner/metrics.js'

const RETURNED = ['angular', 'typescript', 'jest', 'nestjs', 'tailwind']

describe('recallAt', () => {
  it('reports the share of expected skills found within the cut-off', () => {
    expect(recallAt(RETURNED, ['angular', 'jest'], 3)).toBe(1)
    expect(recallAt(RETURNED, ['angular', 'jest'], 1)).toBe(0.5)
  })

  it('reports zero when nothing expected was returned', () => {
    expect(recallAt(RETURNED, ['svelte'], 5)).toBe(0)
  })

  it('ignores expected skills beyond the cut-off', () => {
    expect(recallAt(RETURNED, ['tailwind'], 3)).toBe(0)
    expect(recallAt(RETURNED, ['tailwind'], 5)).toBe(1)
  })

  it('is zero when nothing is expected, since there is nothing to recall', () => {
    expect(recallAt(RETURNED, [], 5)).toBe(0)
  })

  it('is zero when nothing was returned', () => {
    expect(recallAt([], ['angular'], 5)).toBe(0)
  })
})

describe('precisionAt', () => {
  it('reports the share of returned skills that were expected', () => {
    expect(precisionAt(RETURNED, ['angular', 'typescript', 'jest'], 3)).toBe(1)
  })

  it('counts the noise inside the cut-off', () => {
    expect(precisionAt(RETURNED, ['angular'], 2)).toBe(0.5)
  })

  it('divides by what was returned, not by the cut-off', () => {
    // Returning two correct results is a clean answer, not a 40% one.
    expect(precisionAt(['angular', 'jest'], ['angular', 'jest'], 5)).toBe(1)
  })

  it('is zero when nothing was returned', () => {
    expect(precisionAt([], ['angular'], 5)).toBe(0)
  })
})

describe('reciprocalRank', () => {
  it('is 1 when the first result is expected', () => {
    expect(reciprocalRank(RETURNED, ['angular'])).toBe(1)
  })

  it('falls off with the position of the first hit', () => {
    expect(reciprocalRank(RETURNED, ['typescript'])).toBe(0.5)
    expect(reciprocalRank(RETURNED, ['jest'])).toBeCloseTo(1 / 3)
  })

  it('uses the earliest expected skill when several match', () => {
    expect(reciprocalRank(RETURNED, ['jest', 'angular'])).toBe(1)
  })

  it('is zero when no expected skill appears', () => {
    expect(reciprocalRank(RETURNED, ['svelte'])).toBe(0)
  })
})

describe('ndcgAt', () => {
  it('is 1 when every expected skill leads the ranking', () => {
    expect(ndcgAt(RETURNED, ['angular', 'typescript'], 5)).toBe(1)
  })

  it('is below 1 when an expected skill ranks late', () => {
    expect(ndcgAt(RETURNED, ['angular', 'tailwind'], 5)).toBeLessThan(1)
  })

  it('rewards a better ordering of the same results', () => {
    const better = ndcgAt(['angular', 'nestjs', 'jest'], ['angular', 'jest'], 3)
    const worse = ndcgAt(['nestjs', 'angular', 'jest'], ['angular', 'jest'], 3)

    expect(better).toBeGreaterThan(worse)
  })

  it('is zero when nothing expected was returned', () => {
    expect(ndcgAt(RETURNED, ['svelte'], 5)).toBe(0)
  })

  it('is zero when nothing is expected', () => {
    expect(ndcgAt(RETURNED, [], 5)).toBe(0)
  })
})

describe('countForbidden', () => {
  it('counts skills that must never appear', () => {
    expect(countForbidden(RETURNED, ['nestjs', 'svelte'], 5)).toBe(1)
  })

  it('only counts within the cut-off', () => {
    expect(countForbidden(RETURNED, ['nestjs'], 3)).toBe(0)
  })

  it('is zero when nothing is forbidden', () => {
    expect(countForbidden(RETURNED, [], 5)).toBe(0)
  })
})

describe('falsePositiveRate', () => {
  it('reports the share of returned skills nobody asked for', () => {
    expect(falsePositiveRate(RETURNED, ['angular', 'typescript', 'jest'], 5)).toBe(0.4)
  })

  it('is zero when every returned skill was expected', () => {
    expect(falsePositiveRate(['angular'], ['angular', 'jest'], 5)).toBe(0)
  })

  it('is zero when nothing was returned, since nothing was activated', () => {
    expect(falsePositiveRate([], ['angular'], 5)).toBe(0)
  })

  it('is 1 when nothing returned was expected', () => {
    expect(falsePositiveRate(['nestjs'], ['angular'], 5)).toBe(1)
  })
})
