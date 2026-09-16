import { parseSkillManifest } from '../../../../src/infrastructure/manifest/manifest-schema.js'
import { InvalidManifestError } from '../../../../src/domain/skill/errors.js'

const MINIMAL = { name: 'angular', description: 'Angular framework practices.' }

describe('parseSkillManifest', () => {
  it('accepts a manifest carrying only the required fields', () => {
    expect(parseSkillManifest(MINIMAL)).toEqual({
      name: 'angular',
      version: 1,
      description: 'Angular framework practices.',
      tags: [],
      phases: [],
      intents: [],
      languages: [],
      frameworks: [],
      filePatterns: [],
      related: [],
      excludes: { intents: [], frameworks: [], languages: [] },
    })
  })

  it('accepts the full manifest documented in the plan', () => {
    const manifest = parseSkillManifest({
      name: 'angular',
      version: 1,
      description: 'Angular framework practices for implementing applications.',
      tags: ['angular', 'frontend', 'typescript', 'component'],
      phases: ['planning', 'implementation', 'testing', 'review'],
      intents: ['create-component', 'modify-component', 'create-service'],
      languages: ['typescript'],
      frameworks: ['angular'],
      filePatterns: ['**/*.component.ts', '**/*.component.html', '**/*.spec.ts'],
      related: ['typescript', 'jest'],
      excludes: { intents: ['backend-only'], frameworks: ['react', 'vue'] },
    })

    expect(manifest.phases).toEqual(['implementation', 'planning', 'review', 'testing'])
    expect(manifest.excludes.frameworks).toEqual(['react', 'vue'])
    expect(manifest.excludes.languages).toEqual([])
  })
})

describe('parseSkillManifest normalization', () => {
  it('trims, lowercases, de-duplicates and sorts taxonomy terms', () => {
    const manifest = parseSkillManifest({
      ...MINIMAL,
      tags: ['  Frontend ', 'angular', 'ANGULAR', 'component'],
    })

    expect(manifest.tags).toEqual(['angular', 'component', 'frontend'])
  })

  it('produces identical output for inputs that differ only in case, order or spacing', () => {
    const first = parseSkillManifest({ ...MINIMAL, frameworks: ['Angular', ' rxjs'] })
    const second = parseSkillManifest({ ...MINIMAL, frameworks: ['rxjs  ', 'ANGULAR'] })

    expect(first).toEqual(second)
  })

  it('preserves the case of file patterns, which are matched against real paths', () => {
    const manifest = parseSkillManifest({ ...MINIMAL, filePatterns: ['**/*.Component.ts'] })

    expect(manifest.filePatterns).toEqual(['**/*.Component.ts'])
  })

  it('de-duplicates file patterns without altering them', () => {
    const manifest = parseSkillManifest({
      ...MINIMAL,
      filePatterns: ['**/*.ts', '**/*.ts', '**/*.html'],
    })

    expect(manifest.filePatterns).toEqual(['**/*.html', '**/*.ts'])
  })

  it('collapses the whitespace that YAML folded scalars introduce in descriptions', () => {
    const manifest = parseSkillManifest({
      ...MINIMAL,
      description: '  Angular framework practices\n  for implementing applications.  ',
    })

    expect(manifest.description).toBe('Angular framework practices for implementing applications.')
  })

  it('drops terms that normalize to an empty string', () => {
    expect(parseSkillManifest({ ...MINIMAL, tags: ['angular', '   ', ''] }).tags).toEqual([
      'angular',
    ])
  })
})

describe('parseSkillManifest validation', () => {
  it('rejects a name that is not lowercase kebab-case', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, name: 'Angular Router' })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects a name containing a path traversal segment', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, name: '../escape' })).toThrow(
      InvalidManifestError,
    )
  })

  it.each([
    ['a missing name', { description: 'x' }],
    ['a missing description', { name: 'angular' }],
    ['an empty description', { name: 'angular', description: '   ' }],
    ['a non-object input', 'not a manifest'],
    ['a null input', null],
    ['an array input', []],
  ])('rejects %s', (_label, input) => {
    expect(() => parseSkillManifest(input)).toThrow(InvalidManifestError)
  })

  it('rejects unknown top-level fields, which would otherwise be silently ignored', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, framework: 'angular' })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects unknown fields inside excludes', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, excludes: { tags: ['react'] } })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects a phase outside the supported lifecycle', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, phases: ['deployment'] })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects a version that is not a positive integer', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, version: 0 })).toThrow(InvalidManifestError)
    expect(() => parseSkillManifest({ ...MINIMAL, version: 1.5 })).toThrow(InvalidManifestError)
  })

  it('rejects a description beyond the size limit', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, description: 'a'.repeat(1025) })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects a term beyond the size limit', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, tags: ['a'.repeat(65)] })).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects an array beyond the item limit', () => {
    const tags = Array.from({ length: 65 }, (_unused, index) => `tag-${String(index)}`)

    expect(() => parseSkillManifest({ ...MINIMAL, tags })).toThrow(InvalidManifestError)
  })

  it('rejects a taxonomy entry that is not a string', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, tags: [42] })).toThrow(InvalidManifestError)
  })
})

describe('InvalidManifestError', () => {
  it('reports the field that failed so the author can fix it', () => {
    expect.assertions(3)

    try {
      parseSkillManifest({ ...MINIMAL, phases: ['deployment'] })
    } catch (error) {
      const manifestError = error as InvalidManifestError

      expect(manifestError.code).toBe('INVALID_MANIFEST')
      expect(manifestError.issues).toHaveLength(1)
      expect(manifestError.issues[0]?.path).toBe('phases.0')
    }
  })

  it('reports every failing field at once, not just the first', () => {
    expect.assertions(1)

    try {
      parseSkillManifest({ name: 'Bad Name', description: '', phases: ['deployment'] })
    } catch (error) {
      expect((error as InvalidManifestError).issues.length).toBeGreaterThan(1)
    }
  })

  it('summarizes the issues in the message', () => {
    expect(() => parseSkillManifest({ ...MINIMAL, name: 'Bad Name' })).toThrow(/name/)
  })
})
