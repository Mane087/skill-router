import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalizeRoot } from '../../src/infrastructure/filesystem/safe-path.js'
import { scanSkillRoot } from '../../src/infrastructure/registry/skill-scanner.js'
import { formatSkillId } from '../../src/domain/skill/skill-id.js'

const POLICY = { followSymlinks: false, linksMayLeaveRoot: false }
const LIMITS = { maxSkills: 100 }

let workspace: string

beforeAll(async () => {
  workspace = await canonicalizeRoot(await mkdtemp(join(tmpdir(), 'skill-router-scan-')))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

let counter = 0

async function makeRoot(skills: Record<string, string | null>): Promise<string> {
  counter += 1
  const root = join(workspace, `root-${String(counter)}`)
  await mkdir(root, { recursive: true })

  for (const [directory, content] of Object.entries(skills)) {
    await mkdir(join(root, directory), { recursive: true })

    if (content !== null) {
      await writeFile(join(root, directory, 'SKILL.md'), content)
    }
  }

  return root
}

function manifest(name: string, extra = ''): string {
  return `---\nname: ${name}\ndescription: Skill ${name}.\n${extra}---\n\n# ${name}\n`
}

describe('scanSkillRoot', () => {
  it('discovers every directory holding a SKILL.md', async () => {
    const root = await makeRoot({ angular: manifest('angular'), jest: manifest('jest') })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills.map((entry) => formatSkillId(entry.skill.id))).toEqual([
      'global:angular',
      'global:jest',
    ])
    expect(result.diagnostics).toEqual([])
  })

  it('returns skills in a deterministic order regardless of filesystem order', async () => {
    const root = await makeRoot({
      zod: manifest('zod'),
      angular: manifest('angular'),
      jest: manifest('jest'),
    })

    const names = (await scanSkillRoot(root, 'global', POLICY, LIMITS)).skills.map(
      (entry) => entry.skill.manifest.name,
    )

    expect(names).toEqual(['angular', 'jest', 'zod'])
  })

  it('records the directory holding each skill', async () => {
    const root = await makeRoot({ angular: manifest('angular') })

    const [entry] = (await scanSkillRoot(root, 'global', POLICY, LIMITS)).skills

    expect(entry?.directory).toBe(join(root, 'angular'))
  })

  it('applies the requested scope to every skill', async () => {
    const root = await makeRoot({ angular: manifest('angular') })

    const result = await scanSkillRoot(root, 'project', POLICY, LIMITS)

    expect(result.skills[0]?.skill.id.scope).toBe('project')
  })

  it('returns nothing for an empty root', async () => {
    const root = await makeRoot({})

    await expect(scanSkillRoot(root, 'global', POLICY, LIMITS)).resolves.toEqual({
      skills: [],
      diagnostics: [],
    })
  })

  it('ignores directories without a SKILL.md', async () => {
    const root = await makeRoot({ angular: manifest('angular'), notaskill: null })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills).toHaveLength(1)
    expect(result.diagnostics).toEqual([])
  })

  it('ignores loose files at the root', async () => {
    const root = await makeRoot({ angular: manifest('angular') })
    await writeFile(join(root, 'README.md'), '# not a skill')

    await expect(scanSkillRoot(root, 'global', POLICY, LIMITS)).resolves.toMatchObject({
      skills: [{ skill: { manifest: { name: 'angular' } } }],
    })
  })
})

describe('scanSkillRoot diagnostics', () => {
  it('reports an invalid manifest without dropping the valid ones', async () => {
    const root = await makeRoot({
      angular: manifest('angular'),
      broken: '---\nname: broken\n---\n',
    })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills.map((entry) => entry.skill.manifest.name)).toEqual(['angular'])
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.path).toContain('broken')
  })

  it('reports a manifest whose name does not match its directory', async () => {
    const root = await makeRoot({ angular: manifest('react') })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills).toEqual([])
    expect(result.diagnostics[0]?.reason).toMatch(/director/i)
  })

  it('stops at the configured skill limit and says so', async () => {
    const root = await makeRoot({
      a: manifest('a'),
      b: manifest('b'),
      c: manifest('c'),
    })

    const result = await scanSkillRoot(root, 'global', POLICY, { maxSkills: 2 })

    expect(result.skills).toHaveLength(2)
    expect(result.diagnostics[0]?.reason).toMatch(/limit/i)
  })

  it('reports a skill directory reached through a symlink when the policy forbids it', async () => {
    const target = join(workspace, 'linked-skill-target')
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'SKILL.md'), manifest('linked'))

    const root = await makeRoot({ angular: manifest('angular') })
    await symlink(target, join(root, 'linked'))

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills.map((entry) => entry.skill.manifest.name)).toEqual(['angular'])
    expect(result.diagnostics).toHaveLength(1)
  })

  it('rejects a root that does not exist', async () => {
    await expect(
      scanSkillRoot(join(workspace, 'absent-root'), 'global', POLICY, LIMITS),
    ).rejects.toThrow()
  })
})

describe('scanSkillRoot with foreign frontmatter', () => {
  it('keeps a skill whose frontmatter carries fields written by other tools', async () => {
    const root = await makeRoot({
      angular: manifest('angular', 'allowed-tools:\n  - Read\nlicense: MIT\n'),
    })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.skills.map((entry) => formatSkillId(entry.skill.id))).toEqual(['global:angular'])
  })

  it('reports the fields it ignored, so a misspelling is still visible', async () => {
    const root = await makeRoot({ angular: manifest('angular', 'framework: angular\n') })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.diagnostics).toEqual([
      {
        path: join(root, 'angular', 'SKILL.md'),
        reason: 'Ignored unknown frontmatter fields: framework.',
      },
    ])
  })

  it('reports nothing for a manifest that declares only known fields', async () => {
    const root = await makeRoot({ angular: manifest('angular', 'tags: [angular]\n') })

    const result = await scanSkillRoot(root, 'global', POLICY, LIMITS)

    expect(result.diagnostics).toEqual([])
  })
})
