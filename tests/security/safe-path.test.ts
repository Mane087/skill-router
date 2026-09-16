import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  canonicalizeRoot,
  resolveWithinRoot,
} from '../../src/infrastructure/filesystem/safe-path.js'
import { UnsafePathError } from '../../src/domain/errors.js'

const FOLLOW = { followSymlinks: true }
const NO_FOLLOW = { followSymlinks: false }

let workspace: string
let root: string
let outside: string

beforeAll(async () => {
  workspace = await canonicalizeRoot(await mkdtemp(join(tmpdir(), 'skill-router-path-')))
  root = join(workspace, 'root')
  outside = join(workspace, 'outside')

  await mkdir(join(root, 'nested'), { recursive: true })
  await mkdir(outside, { recursive: true })
  await writeFile(join(root, 'inside.md'), 'inside')
  await writeFile(join(root, 'nested', 'deep.md'), 'deep')
  await writeFile(join(outside, 'secret.md'), 'secret')

  await symlink(join(outside, 'secret.md'), join(root, 'escaping-link.md'))
  await symlink(join(root, 'inside.md'), join(root, 'internal-link.md'))
  await symlink(outside, join(root, 'escaping-dir'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe('resolveWithinRoot', () => {
  it('resolves a file inside the root', async () => {
    await expect(resolveWithinRoot(root, 'inside.md', NO_FOLLOW)).resolves.toBe(
      join(root, 'inside.md'),
    )
  })

  it('resolves a file in a nested directory', async () => {
    await expect(resolveWithinRoot(root, join('nested', 'deep.md'), NO_FOLLOW)).resolves.toBe(
      join(root, 'nested', 'deep.md'),
    )
  })

  it('resolves the root itself for an empty path', async () => {
    await expect(resolveWithinRoot(root, '', NO_FOLLOW)).resolves.toBe(root)
  })
})

describe('resolveWithinRoot rejections', () => {
  it.each([
    ['a parent traversal', '../outside/secret.md'],
    ['a traversal through a nested directory', 'nested/../../outside/secret.md'],
    ['a bare parent segment', '..'],
    ['an absolute path', '/etc/passwd'],
  ])('rejects %s', async (_label, candidate) => {
    await expect(resolveWithinRoot(root, candidate, FOLLOW)).rejects.toThrow(UnsafePathError)
  })

  it('rejects a path containing a null byte', async () => {
    const candidate = `inside${String.fromCharCode(0)}.md`

    await expect(resolveWithinRoot(root, candidate, FOLLOW)).rejects.toThrow(UnsafePathError)
  })

  it('rejects a path that does not exist', async () => {
    await expect(resolveWithinRoot(root, 'missing.md', FOLLOW)).rejects.toThrow(UnsafePathError)
  })
})

describe('resolveWithinRoot symlink handling', () => {
  it('rejects a symlink escaping the root even when links are allowed', async () => {
    await expect(resolveWithinRoot(root, 'escaping-link.md', FOLLOW)).rejects.toThrow(
      UnsafePathError,
    )
  })

  it('rejects a path reached through a symlinked directory escaping the root', async () => {
    await expect(resolveWithinRoot(root, 'escaping-dir/secret.md', FOLLOW)).rejects.toThrow(
      UnsafePathError,
    )
  })

  it('follows a symlink that stays inside the root when links are allowed', async () => {
    await expect(resolveWithinRoot(root, 'internal-link.md', FOLLOW)).resolves.toBe(
      join(root, 'inside.md'),
    )
  })

  it('rejects any symlink when the policy forbids following them', async () => {
    await expect(resolveWithinRoot(root, 'internal-link.md', NO_FOLLOW)).rejects.toThrow(
      UnsafePathError,
    )
  })

  it('still resolves regular files when the policy forbids symlinks', async () => {
    await expect(resolveWithinRoot(root, 'inside.md', NO_FOLLOW)).resolves.toBe(
      join(root, 'inside.md'),
    )
  })
})

describe('canonicalizeRoot', () => {
  it('resolves a root that is itself a symlink', async () => {
    const linkedRoot = join(workspace, 'linked-root')
    await symlink(root, linkedRoot)

    await expect(canonicalizeRoot(linkedRoot)).resolves.toBe(root)
  })

  it('expands a leading tilde to the home directory', async () => {
    await expect(canonicalizeRoot('~')).resolves.not.toContain('~')
  })

  it('rejects a root that does not exist', async () => {
    await expect(canonicalizeRoot(join(workspace, 'absent'))).rejects.toThrow(UnsafePathError)
  })
})
