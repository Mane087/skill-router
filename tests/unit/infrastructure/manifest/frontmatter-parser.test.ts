import { parseFrontmatter } from '../../../../src/infrastructure/manifest/frontmatter-parser.js'
import { InvalidManifestError } from '../../../../src/domain/skill/errors.js'

const DOCUMENT = ['---', 'name: angular', 'tags:', '  - frontend', '---', '# Angular', '', 'Body.']

describe('parseFrontmatter', () => {
  it('splits the YAML block from the markdown body', () => {
    const result = parseFrontmatter(DOCUMENT.join('\n'))

    expect(result.frontmatter).toEqual({ name: 'angular', tags: ['frontend'] })
    expect(result.body).toBe('# Angular\n\nBody.')
  })

  it('keeps a horizontal rule inside the body instead of treating it as a delimiter', () => {
    const content = ['---', 'name: angular', '---', 'Intro', '', '---', '', 'Outro'].join('\n')

    expect(parseFrontmatter(content).body).toBe('Intro\n\n---\n\nOutro')
  })

  it('returns an empty body when the document is only frontmatter', () => {
    expect(parseFrontmatter('---\nname: angular\n---\n').body).toBe('')
  })

  it('accepts CRLF line endings', () => {
    const result = parseFrontmatter('---\r\nname: angular\r\n---\r\nBody.')

    expect(result.frontmatter).toEqual({ name: 'angular' })
    expect(result.body).toBe('Body.')
  })

  it('accepts a leading byte order mark', () => {
    expect(parseFrontmatter('﻿---\nname: angular\n---\n').frontmatter).toEqual({
      name: 'angular',
    })
  })
})

describe('parseFrontmatter rejections', () => {
  it.each([
    ['a document without frontmatter', '# Angular\n\nBody.'],
    ['an unterminated frontmatter block', '---\nname: angular\n\nBody.'],
    ['frontmatter that does not start on the first line', '\n---\nname: angular\n---\n'],
    ['malformed YAML', '---\nname: [angular\n---\n'],
    ['duplicate keys', '---\nname: angular\nname: react\n---\n'],
    ['an empty frontmatter block', '---\n---\n'],
    ['a scalar instead of a mapping', '---\njust a string\n---\n'],
    ['a sequence instead of a mapping', '---\n- angular\n---\n'],
  ])('rejects %s', (_label, content) => {
    expect(() => parseFrontmatter(content)).toThrow(InvalidManifestError)
  })

  it('rejects an unknown YAML tag instead of silently resolving it', () => {
    expect(() => parseFrontmatter('---\nname: !custom angular\n---\n')).toThrow(
      InvalidManifestError,
    )
  })

  it('rejects a binary tag, which would inject a Buffer into the manifest', () => {
    expect(() => parseFrontmatter('---\nname: !!binary aGk=\n---\n')).toThrow(InvalidManifestError)
  })

  it('rejects a timestamp tag, which would inject a Date into the manifest', () => {
    expect(() => parseFrontmatter('---\nname: !!timestamp 2026-01-01\n---\n')).toThrow(
      InvalidManifestError,
    )
  })

  it.each([
    ['infinity', '.inf'],
    ['negative infinity', '-.inf'],
    ['not-a-number', '.nan'],
  ])('rejects %s, which YAML resolves to a non-finite number', (_label, scalar) => {
    expect(() => parseFrontmatter(`---\nversion: ${scalar}\n---\n`)).toThrow(InvalidManifestError)
  })

  it('rejects a document beyond the size limit', () => {
    const oversized = `---\nname: angular\n---\n${'a'.repeat(256 * 1024)}`

    expect(() => parseFrontmatter(oversized)).toThrow(InvalidManifestError)
  })

  it('rejects a frontmatter block beyond the size limit', () => {
    const oversized = `---\nname: angular\ndescription: ${'a'.repeat(16 * 1024)}\n---\n`

    expect(() => parseFrontmatter(oversized)).toThrow(InvalidManifestError)
  })

  it('rejects structures nested beyond the depth limit', () => {
    const depth = 12
    const lines = Array.from({ length: depth }, (_unused, index) => `${'  '.repeat(index)}a:`)
    const content = `---\n${lines.join('\n')} value\n---\n`

    expect(() => parseFrontmatter(content)).toThrow(InvalidManifestError)
  })

  it('rejects an alias expansion bomb', () => {
    const aliases = Array.from({ length: 200 }, () => '*base').join(', ')
    const content = `---\nbase: &base anchor\nvalues: [${aliases}]\n---\n`

    expect(() => parseFrontmatter(content)).toThrow(InvalidManifestError)
  })
})

describe('InvalidManifestError from parseFrontmatter', () => {
  it('explains what is wrong with the document', () => {
    expect.assertions(2)

    try {
      parseFrontmatter('# no frontmatter')
    } catch (error) {
      const manifestError = error as InvalidManifestError

      expect(manifestError.code).toBe('INVALID_MANIFEST')
      expect(manifestError.issues).not.toHaveLength(0)
    }
  })
})
