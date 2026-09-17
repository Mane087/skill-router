import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  describeInvalidRootPattern,
  expandRootPattern,
  isRootPattern,
  rootExists,
} from '../../../../src/infrastructure/filesystem/skill-root.js'

let workspace: string
let catalogs: string

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-root-'))
  catalogs = join(workspace, 'catalogs')

  // A plugin cache in miniature: marketplace / plugin / version / skills.
  await mkdir(join(catalogs, 'official', 'superpowers', '6.3.0', 'skills'), { recursive: true })
  await mkdir(join(catalogs, 'official', 'superpowers', '5.0.0', 'skills'), { recursive: true })
  await mkdir(join(catalogs, 'community', 'house-style', '1.0.0', 'skills'), { recursive: true })

  // A plugin with no skills directory at all, and one hidden the way a
  // catalog hides its own internals.
  await mkdir(join(catalogs, 'community', 'no-skills', '1.0.0'), { recursive: true })
  await mkdir(join(catalogs, '.internal', 'hidden', '1.0.0', 'skills'), { recursive: true })

  await writeFile(join(catalogs, 'loose-file'), 'not a directory')
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe('isRootPattern', () => {
  it.each([
    ['a wildcard segment', '~/.claude/plugins/cache/*/*/*/skills', true],
    ['a plain path', '~/.claude/skills', false],
    ['a relative path', '.claude/skills', false],
  ])('recognises %s', (_label, root, expected) => {
    expect(isRootPattern(root)).toBe(expected)
  })
})

describe('describeInvalidRootPattern', () => {
  it('accepts a wildcard that is a whole segment', () => {
    expect(describeInvalidRootPattern('~/catalogs/*/skills')).toBeNull()
  })

  it('accepts a path with no wildcard at all', () => {
    expect(describeInvalidRootPattern('~/.claude/skills')).toBeNull()
  })

  it.each([
    ['a prefix match', 'skills-*'],
    ['a suffix match', '*-skills'],
    ['a recursive wildcard', '~/catalogs/**/skills'],
  ])('rejects %s', (_label, root) => {
    expect(describeInvalidRootPattern(root)).toContain('segment')
  })
})

describe('expandRootPattern', () => {
  it('expands every level of a plugin cache', async () => {
    const matches = await expandRootPattern(join(catalogs, '*', '*', '*', 'skills'))

    // Compared as a set: which one comes first is about write times, and has
    // its own test.
    expect([...matches].sort()).toEqual([
      join(catalogs, 'community', 'house-style', '1.0.0', 'skills'),
      join(catalogs, 'official', 'superpowers', '5.0.0', 'skills'),
      join(catalogs, 'official', 'superpowers', '6.3.0', 'skills'),
    ])
  })

  it('skips a branch with no skills directory', async () => {
    const matches = await expandRootPattern(join(catalogs, 'community', '*', '*', 'skills'))

    expect(matches).not.toContain(join(catalogs, 'community', 'no-skills', '1.0.0', 'skills'))
  })

  it('skips hidden directories, which a catalog uses for its own files', async () => {
    const matches = await expandRootPattern(join(catalogs, '*', '*', '*', 'skills'))

    expect(matches.some((match) => match.includes('.internal'))).toBe(false)
  })

  it('returns nothing when the pattern matches nothing', async () => {
    await expect(expandRootPattern(join(workspace, 'absent', '*', 'skills'))).resolves.toEqual([])
  })

  it('ignores a file where a directory was expected', async () => {
    await expect(expandRootPattern(join(catalogs, '*', 'skills'))).resolves.toEqual([])
  })

  it('stops at the limit rather than walking a whole disk', async () => {
    const many = join(workspace, 'many')

    for (const name of ['one', 'two', 'three']) {
      await mkdir(join(many, name, 'skills'), { recursive: true })
    }

    await expect(expandRootPattern(join(many, '*', 'skills'), 2)).resolves.toHaveLength(2)
    await expect(expandRootPattern(join(many, '*', 'skills'))).resolves.toHaveLength(3)
  })

  it('follows a directory reached through a link, judged by the policy later', async () => {
    const linked = join(workspace, 'linked')
    await symlink(join(catalogs, 'official'), linked)

    const matches = await expandRootPattern(join(workspace, '*', '*', '*', 'skills'))

    expect(matches).toContain(join(linked, 'superpowers', '6.3.0', 'skills'))
  })

  it('expands a leading tilde', async () => {
    const matches = await expandRootPattern('~')

    expect(matches).toEqual([homedir()])
  })

  it('returns the most recently written copy first', async () => {
    const cache = join(workspace, 'cache')
    const older = join(cache, 'aaa-old')
    const newer = join(cache, 'zzz-new')

    for (const version of [older, newer]) {
      await mkdir(join(version, 'skills'), { recursive: true })
    }

    // Written in the order a cache would: the newest copy sorts last by name,
    // so name order and time order disagree, which is the case that matters.
    await utimes(older, new Date('2026-09-04'), new Date('2026-09-04'))
    await utimes(newer, new Date('2026-09-17'), new Date('2026-09-17'))

    await expect(expandRootPattern(join(cache, '*', 'skills'))).resolves.toEqual([
      join(newer, 'skills'),
      join(older, 'skills'),
    ])
  })

  it('orders copies written at the same moment by path', async () => {
    const cache = join(workspace, 'same-time')
    const when = new Date('2026-09-10')

    for (const version of ['b', 'a']) {
      await mkdir(join(cache, version, 'skills'), { recursive: true })
      await utimes(join(cache, version), when, when)
    }

    await expect(expandRootPattern(join(cache, '*', 'skills'))).resolves.toEqual([
      join(cache, 'a', 'skills'),
      join(cache, 'b', 'skills'),
    ])
  })
})

describe('rootExists', () => {
  it('finds a directory that is there', async () => {
    await expect(rootExists(catalogs)).resolves.toBe(true)
  })

  it('reports one that is not', async () => {
    await expect(rootExists(join(workspace, 'absent'))).resolves.toBe(false)
  })

  it('expands a leading tilde before looking', async () => {
    await expect(rootExists('~')).resolves.toBe(true)
  })
})
