import { parseConfig, DEFAULT_CONFIG } from '../../../../src/infrastructure/config/config-schema.js'
import { InvalidConfigError } from '../../../../src/domain/errors.js'

describe('parseConfig', () => {
  it('returns the documented defaults for an empty configuration', () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('defaults to a global and a project root', () => {
    expect(DEFAULT_CONFIG.roots.global).toEqual(['~/.agent-skills'])
    expect(DEFAULT_CONFIG.roots.project).toEqual(['.skills'])
  })

  it('refuses to follow symlinks by default', () => {
    expect(DEFAULT_CONFIG.security.followSymlinks).toBe(false)
  })

  it('overrides only what the file declares', () => {
    const config = parseConfig({ roots: { project: ['.my-skills'] } })

    expect(config.roots.project).toEqual(['.my-skills'])
    expect(config.roots.global).toEqual(DEFAULT_CONFIG.roots.global)
    expect(config.security).toEqual(DEFAULT_CONFIG.security)
  })

  it('accepts custom ranking weights', () => {
    const config = parseConfig({ ranking: { weights: { phase: 40 } } })

    expect(config.ranking.weights.phase).toBe(40)
    expect(config.ranking.weights.framework).toBe(DEFAULT_CONFIG.ranking.weights.framework)
  })

  it.each([
    ['an unknown top-level field', { unknown: true }],
    ['an unknown security field', { security: { followLinks: true } }],
    ['an unknown weight', { ranking: { weights: { popularity: 10 } } }],
    ['a non-object input', 'nope'],
    ['a negative limit', { search: { defaultLimit: -1 } }],
    ['a fractional limit', { search: { defaultLimit: 1.5 } }],
    ['a negative weight', { ranking: { weights: { phase: -5 } } }],
    ['a non-array root', { roots: { global: '~/.skills' } }],
    ['a zero size limit', { security: { maxReferenceSizeKb: 0 } }],
  ])('rejects %s', (_label, input) => {
    expect(() => parseConfig(input)).toThrow(InvalidConfigError)
  })

  it('rejects a default limit above the maximum', () => {
    expect(() => parseConfig({ search: { defaultLimit: 9, maxLimit: 5 } })).toThrow(
      InvalidConfigError,
    )
  })

  it('names the offending field', () => {
    expect(() => parseConfig({ search: { defaultLimit: 0 } })).toThrow(/defaultLimit/)
  })
})
