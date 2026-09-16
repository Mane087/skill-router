import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadSkillDocument } from '../../src/infrastructure/manifest/skill-manifest-loader.js'
import { createSkill } from '../../src/domain/skill/skill.js'
import { formatSkillId } from '../../src/domain/skill/skill-id.js'
import { InvalidManifestError } from '../../src/domain/skill/errors.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'skills')

function readFixture(kind: 'valid' | 'invalid', name: string): Promise<string> {
  return readFile(join(FIXTURES, kind, name, 'SKILL.md'), 'utf8')
}

describe('valid skill fixtures', () => {
  it('parses the documented Angular manifest into normalized metadata', async () => {
    const { manifest, body } = loadSkillDocument(await readFixture('valid', 'angular'))

    expect(manifest).toEqual({
      name: 'angular',
      version: 1,
      description:
        'Angular framework practices for implementing and maintaining Angular applications.',
      tags: ['angular', 'component', 'frontend', 'typescript'],
      phases: ['implementation', 'planning', 'review', 'testing'],
      intents: ['create-component', 'create-service', 'modify-component'],
      languages: ['typescript'],
      frameworks: ['angular'],
      filePatterns: ['**/*.component.html', '**/*.component.ts', '**/*.spec.ts'],
      related: ['jest', 'typescript'],
      excludes: { intents: ['backend-only'], frameworks: ['react', 'vue'], languages: [] },
    })
    expect(body.trim()).toMatch(/^# Angular/)
  })

  it('applies defaults to a manifest that declares only the required fields', async () => {
    const { manifest } = loadSkillDocument(await readFixture('valid', 'minimal'))

    expect(manifest.name).toBe('minimal')
    expect(manifest.version).toBe(1)
    expect(manifest.tags).toEqual([])
    expect(manifest.excludes).toEqual({ intents: [], frameworks: [], languages: [] })
  })

  it('normalizes metadata written in mixed case, out of order and duplicated', async () => {
    const { manifest } = loadSkillDocument(await readFixture('valid', 'unnormalized'))

    expect(manifest.tags).toEqual(['angular', 'component', 'frontend'])
    expect(manifest.phases).toEqual(['implementation', 'testing'])
    expect(manifest.frameworks).toEqual(['angular', 'rxjs'])
    expect(manifest.filePatterns).toEqual(['**/*.Component.ts'])
  })

  it('produces the same result on every parse of the same document', async () => {
    const content = await readFixture('valid', 'angular')

    expect(loadSkillDocument(content)).toEqual(loadSkillDocument(content))
  })
})

describe('invalid skill fixtures', () => {
  it.each([
    'missing-frontmatter',
    'unknown-field',
    'bad-name',
    'unknown-phase',
    'duplicate-keys',
    'malformed-yaml',
    'empty-description',
    'scalar-frontmatter',
  ])('rejects the %s fixture with a reported issue', async (name) => {
    expect.assertions(3)

    try {
      loadSkillDocument(await readFixture('invalid', name))
    } catch (error) {
      const manifestError = error as InvalidManifestError

      expect(manifestError).toBeInstanceOf(InvalidManifestError)
      expect(manifestError.issues).not.toHaveLength(0)
      expect(manifestError.message.length).toBeGreaterThan(0)
    }
  })

  it('names the offending field so the author knows what to fix', async () => {
    expect.assertions(1)

    try {
      loadSkillDocument(await readFixture('invalid', 'unknown-phase'))
    } catch (error) {
      expect((error as InvalidManifestError).issues[0]?.path).toBe('phases.0')
    }
  })
})

describe('createSkill', () => {
  it('derives a scope-qualified identity from the manifest name', async () => {
    const { manifest } = loadSkillDocument(await readFixture('valid', 'angular'))

    expect(formatSkillId(createSkill('global', manifest).id)).toBe('global:angular')
  })

  it('keeps the same skill distinct across scopes', async () => {
    const { manifest } = loadSkillDocument(await readFixture('valid', 'angular'))

    const global = createSkill('global', manifest)
    const project = createSkill('project', manifest)

    expect(formatSkillId(global.id)).not.toBe(formatSkillId(project.id))
  })
})
