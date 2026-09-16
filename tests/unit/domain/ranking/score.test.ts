import { combineSignals, roundScore } from '../../../../src/domain/ranking/score.js'
import type { SignalScore } from '../../../../src/domain/ranking/score.js'

function signal(overrides: Partial<SignalScore> = {}): SignalScore {
  return { signal: 'phase', weight: 10, ratio: 1, applicable: true, detail: 'x', ...overrides }
}

describe('combineSignals', () => {
  it('returns 1 when every applicable signal matched fully', () => {
    expect(combineSignals([signal(), signal({ signal: 'framework' })])).toBe(1)
  })

  it('returns 0 when nothing matched', () => {
    expect(combineSignals([signal({ ratio: 0 })])).toBe(0)
  })

  it('weights signals by their configured importance', () => {
    const scores = [
      signal({ signal: 'phase', weight: 30, ratio: 1 }),
      signal({ signal: 'tag', weight: 10, ratio: 0 }),
    ]

    expect(combineSignals(scores)).toBe(0.75)
  })

  it('ignores signals the query made inapplicable', () => {
    const scores = [
      signal({ signal: 'phase', weight: 30, ratio: 1 }),
      signal({ signal: 'file', weight: 70, ratio: 0, applicable: false }),
    ]

    expect(combineSignals(scores)).toBe(1)
  })

  it('returns 0 when no signal is applicable', () => {
    expect(combineSignals([signal({ applicable: false })])).toBe(0)
  })

  it('returns 0 for an empty signal list', () => {
    expect(combineSignals([])).toBe(0)
  })

  it('returns 0 when every applicable weight is zero', () => {
    expect(combineSignals([signal({ weight: 0 })])).toBe(0)
  })

  it('never exceeds 1', () => {
    expect(combineSignals([signal({ ratio: 1 }), signal({ ratio: 1 })])).toBeLessThanOrEqual(1)
  })
})

describe('roundScore', () => {
  it('keeps enough precision to separate close results', () => {
    expect(roundScore(0.123456)).toBe(0.1235)
  })

  it('leaves an exact value untouched', () => {
    expect(roundScore(0.5)).toBe(0.5)
  })
})
