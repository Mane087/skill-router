import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CliUsageError } from '../../src/adapters/cli/errors.js'
import { installSkill } from '../../src/adapters/cli/install/skill/skill-installer.js'
import { runCli } from '../../src/adapters/cli/run-cli.js'
import { skillTarget } from '../../src/adapters/cli/install/skill/skill-target.js'
import {
  SKILL_FILES,
  SKILL_NAME,
} from '../../src/adapters/cli/install/skill/skill-files.generated.js'
import type { CliDependencies } from '../../src/adapters/cli/run-cli.js'
import type { InstallClient } from '../../src/adapters/cli/arguments.js'
import type { InstallEnvironment } from '../../src/adapters/cli/install/environment.js'

const KEEP = { force: false, dryRun: false }
const FORCE = { force: true, dryRun: false }
const PLAN = { force: false, dryRun: true }

let workspace: string
let counter = 0

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-skill-'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

/** A home directory of its own per case, so one test cannot see another's writes. */
async function makeEnvironment(
  overrides: Partial<InstallEnvironment> = {},
): Promise<InstallEnvironment> {
  counter += 1
  const home = join(workspace, `case-${String(counter)}`)
  await mkdir(home, { recursive: true })

  return {
    cwd: home,
    home,
    configHome: undefined,
    codexHome: undefined,
    path: undefined,
    pathExtensions: undefined,
    ...overrides,
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)

    return true
  } catch {
    return false
  }
}

describe('skillTarget', () => {
  it('puts the skill where Claude Code looks for it', async () => {
    const environment = await makeEnvironment()

    expect(skillTarget('claude', environment).directory).toBe(
      join(environment.home, '.claude', 'skills', SKILL_NAME),
    )
  })

  it('puts the skill where Codex looks for it', async () => {
    const environment = await makeEnvironment()

    expect(skillTarget('codex', environment).directory).toBe(
      join(environment.home, '.codex', 'skills', SKILL_NAME),
    )
  })

  it('follows CODEX_HOME, since that moves everything Codex reads', async () => {
    const elsewhere = join(workspace, 'codex-elsewhere')
    const environment = await makeEnvironment({ codexHome: elsewhere })

    expect(skillTarget('codex', environment).directory).toBe(join(elsewhere, 'skills', SKILL_NAME))
  })

  it('puts the skill where opencode looks for it', async () => {
    const environment = await makeEnvironment()

    expect(skillTarget('opencode', environment).directory).toBe(
      join(environment.home, '.config', 'opencode', 'skills', SKILL_NAME),
    )
  })

  it('follows XDG_CONFIG_HOME for opencode, like its opencode.json does', async () => {
    const elsewhere = join(workspace, 'xdg-elsewhere')
    const environment = await makeEnvironment({ configHome: elsewhere })

    expect(skillTarget('opencode', environment).directory).toBe(
      join(elsewhere, 'opencode', 'skills', SKILL_NAME),
    )
  })

  it.each<InstallClient>(['claude', 'codex', 'opencode'])(
    'ignores the project directory for %s, because a skill is global',
    async (client) => {
      const environment = await makeEnvironment({ cwd: join(workspace, 'some-checkout') })

      expect(skillTarget(client, environment).directory).not.toContain('some-checkout')
    },
  )
})

describe('installSkill on a machine that has no skill yet', () => {
  it('writes every file the skill is made of', async () => {
    const target = skillTarget('claude', await makeEnvironment())

    const outcome = await installSkill(target, KEEP)

    expect(outcome.action).toBe('added')

    for (const [path, contents] of Object.entries(SKILL_FILES)) {
      expect(await readFile(join(target.directory, ...path.split('/')), 'utf8')).toBe(contents)
    }
  })

  it('creates the nested directories a reference document sits in', async () => {
    const target = skillTarget('claude', await makeEnvironment())

    await installSkill(target, KEEP)

    expect(await exists(join(target.directory, 'references'))).toBe(true)
  })

  it('names the directory it wrote, so the operator can go and read it', async () => {
    const target = skillTarget('opencode', await makeEnvironment())

    const outcome = await installSkill(target, KEEP)

    expect(outcome.summary).toContain(target.directory)
  })
})

describe('installSkill on a machine that already has it', () => {
  it('changes nothing on a second run', async () => {
    const target = skillTarget('claude', await makeEnvironment())

    await installSkill(target, KEEP)
    const outcome = await installSkill(target, KEEP)

    expect(outcome.action).toBe('unchanged')
  })

  it('refuses to overwrite a file somebody edited', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await installSkill(target, KEEP)
    await writeFile(join(target.directory, 'SKILL.md'), '# mine now\n')

    await expect(installSkill(target, KEEP)).rejects.toThrow(CliUsageError)
  })

  it('points at --force, so the refusal says how to get past it', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await installSkill(target, KEEP)
    await writeFile(join(target.directory, 'SKILL.md'), '# mine now\n')

    await expect(installSkill(target, KEEP)).rejects.toThrow(/--force/)
  })

  it('names the file that differs rather than the directory', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await installSkill(target, KEEP)
    await writeFile(join(target.directory, 'SKILL.md'), '# mine now\n')

    await expect(installSkill(target, KEEP)).rejects.toThrow(/SKILL\.md/)
  })

  it('replaces the edited file when --force says so', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await installSkill(target, KEEP)
    await writeFile(join(target.directory, 'SKILL.md'), '# mine now\n')

    const outcome = await installSkill(target, FORCE)

    expect(outcome.action).toBe('updated')
    expect(await readFile(join(target.directory, 'SKILL.md'), 'utf8')).toBe(SKILL_FILES['SKILL.md'])
  })

  it('writes nothing at all when one file differs and --force was not given', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await mkdir(target.directory, { recursive: true })
    await writeFile(join(target.directory, 'SKILL.md'), '# mine now\n')

    await expect(installSkill(target, KEEP)).rejects.toThrow(CliUsageError)
    expect(await exists(join(target.directory, 'references'))).toBe(false)
  })

  it('leaves a file somebody kept beside the skill alone', async () => {
    const target = skillTarget('claude', await makeEnvironment())
    await installSkill(target, KEEP)
    const notes = join(target.directory, 'NOTES.md')
    await writeFile(notes, 'mine\n')

    const outcome = await installSkill(target, KEEP)

    expect(outcome.action).toBe('unchanged')
    expect(await readFile(notes, 'utf8')).toBe('mine\n')
  })
})

describe('installSkill --dry-run', () => {
  it('reports what it would write', async () => {
    const target = skillTarget('claude', await makeEnvironment())

    const outcome = await installSkill(target, PLAN)

    expect(outcome.action).toBe('planned')
    expect(outcome.summary).toContain(target.directory)
  })

  it('writes nothing at all', async () => {
    const target = skillTarget('claude', await makeEnvironment())

    await installSkill(target, PLAN)

    expect(await exists(target.directory)).toBe(false)
  })
})

describe('install <client> --skill, end to end', () => {
  function dependencies(environment: InstallEnvironment): {
    deps: CliDependencies
    out: string[]
  } {
    const out: string[] = []

    return {
      out,
      deps: {
        serve: () => Promise.resolve(),
        run: () => Promise.resolve({ code: 0, stdout: '', stderr: '' }),
        detect: () => Promise.resolve({ installed: true, evidence: 'found it' }),
        environment,
        serverCommand: ['/usr/bin/node', '/opt/skill-router/dist/bootstrap/main.js'],
        out: (line) => out.push(line),
        err: () => undefined,
      },
    }
  }

  it.each<InstallClient>(['claude', 'codex', 'opencode'])(
    'registers the server and installs the skill for %s, reporting both',
    async (client) => {
      const environment = await makeEnvironment()
      const { deps, out } = dependencies(environment)

      expect(await runCli(['install', client, '--skill'], deps)).toBe(0)
      expect(out).toHaveLength(2)
      expect(await exists(join(skillTarget(client, environment).directory, 'SKILL.md'))).toBe(true)
    },
  )

  it('writes no skill when --skill was not asked for', async () => {
    const environment = await makeEnvironment()
    const { deps } = dependencies(environment)

    await runCli(['install', 'claude'], deps)

    expect(await exists(skillTarget('claude', environment).directory)).toBe(false)
  })

  it('installs globally even when the registration is scoped to the project', async () => {
    const environment = await makeEnvironment()
    const { deps } = dependencies(environment)

    expect(await runCli(['install', 'claude', '--scope', 'project', '--skill'], deps)).toBe(0)
    expect(await exists(join(skillTarget('claude', environment).directory, 'SKILL.md'))).toBe(true)
  })

  it('writes nothing when the client is not on this machine', async () => {
    const environment = await makeEnvironment()
    const { deps, out } = dependencies(environment)

    expect(
      await runCli(['install', 'claude', '--skill'], {
        ...deps,
        detect: () => Promise.resolve({ installed: false, evidence: 'nothing here' }),
      }),
    ).toBe(0)
    expect(out.join('\n')).toContain('Skipped')
    expect(await exists(join(environment.home, '.claude'))).toBe(false)
  })
})
