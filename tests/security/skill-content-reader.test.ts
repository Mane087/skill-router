import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createFilesystemSkillContentReader } from '../../src/infrastructure/registry/filesystem-skill-content-reader.js'
import { canonicalizeRoot } from '../../src/infrastructure/filesystem/safe-path.js'
import { createSkillId } from '../../src/domain/skill/skill-id.js'
import {
  ReferenceNotFoundError,
  SkillNotFoundError,
  UnsafePathError,
} from '../../src/domain/errors.js'
import type { ScannedSkill } from '../../src/infrastructure/registry/skill-scanner.js'

const NUL = String.fromCharCode(0)
const POLICY = { followSymlinks: false }
const LIMITS = { maxReferenceBytes: 512 * 1024 }

let workspace: string
let skillDirectory: string
let reader: ReturnType<typeof createFilesystemSkillContentReader>

const ANGULAR = createSkillId('global', 'angular')

beforeAll(async () => {
  workspace = await canonicalizeRoot(await mkdtemp(join(tmpdir(), 'skill-router-content-')))
  skillDirectory = join(workspace, 'roots', 'angular')

  await mkdir(join(skillDirectory, 'references'), { recursive: true })
  await mkdir(join(workspace, 'outside'), { recursive: true })

  await writeFile(
    join(skillDirectory, 'SKILL.md'),
    '---\nname: angular\ndescription: A.\n---\n\nBody.',
  )
  await writeFile(join(skillDirectory, 'references', 'component-testing.md'), '# Component testing')
  await writeFile(join(skillDirectory, 'references', 'forms.md'), '# Forms')
  await writeFile(join(skillDirectory, 'references', 'notes.txt'), 'not markdown')
  await writeFile(join(workspace, 'outside', 'secret.md'), 'secret')
  await symlink(
    join(workspace, 'outside', 'secret.md'),
    join(skillDirectory, 'references', 'link.md'),
  )

  const entries: ScannedSkill[] = [
    {
      skill: { id: ANGULAR, manifest: { name: 'angular' } as never },
      directory: skillDirectory,
    },
  ]

  reader = createFilesystemSkillContentReader(entries, POLICY, LIMITS)
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe('readBody', () => {
  it('returns the markdown after the frontmatter', async () => {
    await expect(reader.readBody(ANGULAR)).resolves.toBe('Body.')
  })

  it('rejects a skill that is not registered', async () => {
    await expect(reader.readBody(createSkillId('global', 'react'))).rejects.toThrow(
      SkillNotFoundError,
    )
  })

  it('rejects a skill registered under another scope', async () => {
    await expect(reader.readBody(createSkillId('project', 'angular'))).rejects.toThrow(
      SkillNotFoundError,
    )
  })
})

describe('listReferences', () => {
  it('lists the markdown references by name, sorted', async () => {
    await expect(reader.listReferences(ANGULAR)).resolves.toEqual(['component-testing', 'forms'])
  })

  it('ignores files that are not markdown', async () => {
    await expect(reader.listReferences(ANGULAR)).resolves.not.toContain('notes')
  })

  it('returns an empty list for a skill without a references directory', async () => {
    const bare = join(workspace, 'roots', 'bare')
    await mkdir(bare, { recursive: true })
    await writeFile(join(bare, 'SKILL.md'), '---\nname: bare\ndescription: B.\n---\n')

    const id = createSkillId('global', 'bare')
    const other = createFilesystemSkillContentReader(
      [{ skill: { id, manifest: { name: 'bare' } as never }, directory: bare }],
      POLICY,
      LIMITS,
    )

    await expect(other.listReferences(id)).resolves.toEqual([])
  })
})

describe('readReference', () => {
  it('returns the content of a reference', async () => {
    await expect(reader.readReference(ANGULAR, 'component-testing')).resolves.toBe(
      '# Component testing',
    )
  })

  it('rejects a reference the skill does not provide', async () => {
    await expect(reader.readReference(ANGULAR, 'missing')).rejects.toThrow(ReferenceNotFoundError)
  })

  it('rejects a reference of an unregistered skill', async () => {
    await expect(reader.readReference(createSkillId('global', 'react'), 'x')).rejects.toThrow(
      SkillNotFoundError,
    )
  })
})

describe('readReference rejects unsafe names', () => {
  it.each([
    ['a parent traversal', '../../../etc/passwd'],
    ['a nested traversal', 'nested/../../escape'],
    ['an absolute path', '/etc/passwd'],
    ['a path separator', 'testing/unit'],
    ['an extension', 'component-testing.md'],
    ['uppercase', 'Component-Testing'],
    ['a null byte', `component${NUL}`],
    ['empty', ''],
  ])('rejects %s', async (_label, reference) => {
    await expect(reader.readReference(ANGULAR, reference)).rejects.toThrow(UnsafePathError)
  })

  it('refuses a reference reached through a symbolic link', async () => {
    await expect(reader.readReference(ANGULAR, 'link')).rejects.toThrow(UnsafePathError)
  })

  it('does not list a symlinked reference either', async () => {
    await expect(reader.listReferences(ANGULAR)).resolves.not.toContain('link')
  })
})
