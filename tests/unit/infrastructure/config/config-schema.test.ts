import { parseConfig, DEFAULT_CONFIG } from '../../../../src/infrastructure/config/config-schema.js'
import { InvalidConfigError } from '../../../../src/domain/errors.js'

describe('parseConfig', () => {
  it('returns the documented defaults for an empty configuration', () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('defaults to the directories the agents themselves document', () => {
    expect(DEFAULT_CONFIG.roots.global.map((root) => root.path)).toEqual([
      '~/.claude/skills',
      '~/.claude/plugins/cache/*/*/*/skills',
      '~/.codex/skills',
      '~/.config/opencode/skills',
      '~/.agents/skills',
    ])
    expect(DEFAULT_CONFIG.roots.project.map((root) => root.path)).toEqual([
      '.claude/skills',
      '.codex/skills',
      '.opencode/skills',
      '.agents/skills',
      '.skills',
    ])
  })

  it('marks a default root as assumed, so its absence stays quiet', () => {
    expect(DEFAULT_CONFIG.roots.global.every((root) => !root.required)).toBe(true)
    expect(DEFAULT_CONFIG.roots.project.every((root) => !root.required)).toBe(true)
  })

  it('marks a declared root as required, so its absence is reported', () => {
    const config = parseConfig({ roots: { global: ['~/.my-skills'] } })

    expect(config.roots.global).toEqual([{ path: '~/.my-skills', required: true }])
  })

  it('keeps an empty list rather than falling back to the defaults', () => {
    const config = parseConfig({ roots: { global: [] } })

    expect(config.roots.global).toEqual([])
    expect(config.roots.project).toEqual(DEFAULT_CONFIG.roots.project)
  })

  it('accepts a whole path segment as a wildcard', () => {
    const config = parseConfig({ roots: { global: ['~/catalogs/*/skills'] } })

    expect(config.roots.global).toEqual([{ path: '~/catalogs/*/skills', required: true }])
  })

  it.each([
    ['a wildcard inside a segment', 'skill*'],
    ['a recursive wildcard', '~/catalogs/**/skills'],
  ])('rejects %s, which the expansion does not implement', (_label, root) => {
    expect(() => parseConfig({ roots: { global: [root] } })).toThrow(InvalidConfigError)
  })

  it('refuses to follow symlinks by default', () => {
    expect(DEFAULT_CONFIG.security.followSymlinks).toBe(false)
  })

  it('overrides only what the file declares', () => {
    const config = parseConfig({ roots: { project: ['.my-skills'] } })

    expect(config.roots.project).toEqual([{ path: '.my-skills', required: true }])
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
