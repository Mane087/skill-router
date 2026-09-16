import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildSkillRegistry } from '../../src/infrastructure/registry/registry-builder.js'
import { canonicalizeRoot } from '../../src/infrastructure/filesystem/safe-path.js'
import { createSkillId, formatSkillId } from '../../src/domain/skill/skill-id.js'

const POLICY = { followSymlinks: false }
const LIMITS = { maxSkills: 100 }

let workspace: string
let counter = 0

beforeAll(async () => {
  workspace = await canonicalizeRoot(await mkdtemp(join(tmpdir(), 'skill-router-registry-')))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

async function makeRoot(names: readonly string[]): Promise<string> {
  counter += 1
  const root = join(workspace, `root-${String(counter)}`)

  for (const name of names) {
    await mkdir(join(root, name), { recursive: true })
    await writeFile(
      join(root, name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Skill ${name}.\n---\n`,
    )
  }

  await mkdir(root, { recursive: true })

  return root
}

function build(global: readonly string[], project: readonly string[]) {
  return buildSkillRegistry({ roots: { global, project }, policy: POLICY, limits: LIMITS })
}

describe('buildSkillRegistry', () => {
  it('combines skills discovered across global and project roots', async () => {
    const globalRoot = await makeRoot(['angular', 'jest'])
    const projectRoot = await makeRoot(['house-style'])

    const registry = await build([globalRoot], [projectRoot])
    const ids = (await registry.repository.list()).map((skill) => formatSkillId(skill.id))

    expect(ids).toEqual(['global:angular', 'global:jest', 'project:house-style'])
  })

  it('keeps a project skill from shadowing the global skill of the same name', async () => {
    const globalRoot = await makeRoot(['angular'])
    const projectRoot = await makeRoot(['angular'])

    const registry = await build([globalRoot], [projectRoot])

    await expect(
      registry.repository.getById(createSkillId('global', 'angular')),
    ).resolves.not.toBeNull()
    await expect(
      registry.repository.getById(createSkillId('project', 'angular')),
    ).resolves.not.toBeNull()
    expect(registry.diagnostics).toEqual([])
  })

  it('builds an empty registry when no root is configured', async () => {
    const registry = await build([], [])

    await expect(registry.repository.list()).resolves.toEqual([])
    expect(registry.diagnostics).toEqual([])
  })

  it('records the directory of every discovered skill', async () => {
    const globalRoot = await makeRoot(['angular'])

    const registry = await build([globalRoot], [])

    expect(registry.entries[0]?.directory).toBe(join(globalRoot, 'angular'))
  })
})

describe('buildSkillRegistry diagnostics', () => {
  it('reports an unreachable root instead of failing the whole build', async () => {
    const globalRoot = await makeRoot(['angular'])

    const registry = await build([globalRoot, join(workspace, 'absent')], [])

    await expect(registry.repository.list()).resolves.toHaveLength(1)
    expect(registry.diagnostics).toHaveLength(1)
    expect(registry.diagnostics[0]?.path).toContain('absent')
  })

  it('keeps the first root and reports a skill duplicated across roots of one scope', async () => {
    const first = await makeRoot(['angular'])
    const second = await makeRoot(['angular'])

    const registry = await build([first, second], [])

    await expect(registry.repository.list()).resolves.toHaveLength(1)
    expect(registry.entries[0]?.directory).toBe(join(first, 'angular'))
    expect(registry.diagnostics[0]?.reason).toMatch(/duplicate/i)
  })

  it('carries forward the diagnostics reported while scanning', async () => {
    const root = await makeRoot(['angular'])
    await mkdir(join(root, 'broken'), { recursive: true })
    await writeFile(join(root, 'broken', 'SKILL.md'), '---\nname: broken\n---\n')

    const registry = await build([root], [])

    await expect(registry.repository.list()).resolves.toHaveLength(1)
    expect(registry.diagnostics).toHaveLength(1)
    expect(registry.diagnostics[0]?.path).toContain('broken')
  })
})
