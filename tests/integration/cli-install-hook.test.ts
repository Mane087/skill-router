import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CliFailureError, CliUsageError } from '../../src/adapters/cli/errors.js'
import { claudeHookTarget } from '../../src/adapters/cli/install/hooks/claude-hook.js'
import { codexHookTarget } from '../../src/adapters/cli/install/hooks/codex-hook.js'
import { installHook } from '../../src/adapters/cli/install/hooks/hook-installer.js'
import { runCli } from '../../src/adapters/cli/run-cli.js'
import {
  CLAUDE_HOOK_SCRIPT,
  CODEX_HOOK_SCRIPT,
} from '../../src/adapters/cli/install/hooks/hook-scripts.generated.js'
import type { CliDependencies } from '../../src/adapters/cli/run-cli.js'
import type { InstallEnvironment } from '../../src/adapters/cli/install/environment.js'

const KEEP = { force: false, dryRun: false }
const FORCE = { force: true, dryRun: false }
const PLAN = { force: false, dryRun: true }

let workspace: string
let counter = 0

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-hook-'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

/** A home directory of its own per case, so one test cannot see another's writes. */
async function makeEnvironment(codexHome?: string): Promise<InstallEnvironment> {
  counter += 1
  const home = join(workspace, `case-${String(counter)}`)
  await mkdir(home, { recursive: true })

  return {
    cwd: home,
    home,
    configHome: undefined,
    codexHome,
    path: undefined,
    pathExtensions: undefined,
  }
}

function readJson(path: string): Promise<unknown> {
  return readFile(path, 'utf8').then((raw) => JSON.parse(raw) as unknown)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)

    return true
  } catch {
    return false
  }
}

describe('installHook on a machine that has no hook yet', () => {
  it('writes the script Claude Code will run', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    const outcome = await installHook(target, KEEP)

    expect(outcome.action).toBe('added')
    expect(await readFile(target.scriptPath, 'utf8')).toBe(CLAUDE_HOOK_SCRIPT)
  })

  it('puts the script where Claude Code looks for its hooks', async () => {
    const environment = await makeEnvironment()

    expect(claudeHookTarget(environment).scriptPath).toBe(
      join(environment.home, '.claude', 'hooks', 'skill-router-nudge.sh'),
    )
  })

  it('makes the script executable, since a hook that cannot run is a silent no-op', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    await installHook(target, KEEP)

    expect((await stat(target.scriptPath)).mode & 0o777).toBe(0o755)
  })

  it('registers the entry under PreToolUse in settings.json', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    await installHook(target, KEEP)

    expect(await readJson(target.configPath)).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Skill|Read|Glob|Grep',
            hooks: [
              {
                type: 'command',
                command: 'bash ~/.claude/hooks/skill-router-nudge.sh',
                timeout: 5,
                statusMessage: 'Consultando política de skills',
              },
            ],
          },
        ],
      },
    })
  })

  it('ends the file with a newline, like every other file in this repository', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    await installHook(target, KEEP)

    expect(await readFile(target.configPath, 'utf8')).toMatch(/\n$/)
  })

  it('names both files it wrote, so the operator can go and read them', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    const outcome = await installHook(target, KEEP)

    expect(outcome.summary).toContain('skill-router-nudge.sh')
    expect(outcome.summary).toContain('settings.json')
  })
})

describe('installHook on Codex', () => {
  it('writes its own script, which filters differently from the one Claude Code runs', async () => {
    const target = codexHookTarget(await makeEnvironment())

    await installHook(target, KEEP)

    expect(await readFile(target.scriptPath, 'utf8')).toBe(CODEX_HOOK_SCRIPT)
  })

  it('writes hooks.json rather than settings.json', async () => {
    const environment = await makeEnvironment()

    expect(codexHookTarget(environment).configPath).toBe(
      join(environment.home, '.codex', 'hooks.json'),
    )
  })

  it('matches every tool, because the Codex script does its own filtering', async () => {
    const target = codexHookTarget(await makeEnvironment())

    await installHook(target, KEEP)

    expect(await readJson(target.configPath)).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: '.*',
            hooks: [
              {
                type: 'command',
                command: 'bash "${CODEX_HOME:-$HOME/.codex}/hooks/skill-router-nudge.sh"',
                timeout: 5,
                statusMessage: 'Consultando política de skills',
              },
            ],
          },
        ],
      },
    })
  })

  it('writes where CODEX_HOME points, since that is where the command it writes will look', async () => {
    const elsewhere = join(workspace, 'somewhere-else')
    const environment = await makeEnvironment(elsewhere)

    const target = codexHookTarget(environment)
    await installHook(target, KEEP)

    expect(target.configPath).toBe(join(elsewhere, 'hooks.json'))
    expect(await exists(join(elsewhere, 'hooks', 'skill-router-nudge.sh'))).toBe(true)
  })
})

describe('installHook on a machine that already has a configuration', () => {
  it('leaves every unrelated setting alone', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(
      target.configPath,
      `${JSON.stringify({ theme: 'dark', permissions: { allow: ['Bash'] } }, null, 2)}\n`,
    )

    await installHook(target, KEEP)

    expect(await readJson(target.configPath)).toMatchObject({
      theme: 'dark',
      permissions: { allow: ['Bash'] },
    })
  })

  it('keeps the hooks somebody else put there', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    const mine = {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'bash ~/.claude/hooks/guard.sh', timeout: 5 }],
    }
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(target.configPath, `${JSON.stringify({ hooks: { PreToolUse: [mine] } })}\n`)

    await installHook(target, KEEP)
    const config = (await readJson(target.configPath)) as { hooks: { PreToolUse: unknown[] } }

    expect(config.hooks.PreToolUse).toHaveLength(2)
    expect(config.hooks.PreToolUse[0]).toEqual(mine)
  })

  it('changes nothing on a second run', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    await installHook(target, KEEP)
    const outcome = await installHook(target, KEEP)
    const config = (await readJson(target.configPath)) as { hooks: { PreToolUse: unknown[] } }

    expect(outcome.action).toBe('unchanged')
    expect(config.hooks.PreToolUse).toHaveLength(1)
  })

  it('refuses to replace an entry that was edited by hand', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(
      target.configPath,
      `${JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Skill',
              hooks: [
                { type: 'command', command: 'bash ~/.claude/hooks/skill-router-nudge.sh --loud' },
              ],
            },
          ],
        },
      })}\n`,
    )

    await expect(installHook(target, KEEP)).rejects.toThrow(CliUsageError)
  })

  it('points at --force, so the refusal says how to get past it', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(
      target.configPath,
      `${JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: 'Skill', hooks: [{ type: 'command', command: 'skill-router-nudge.sh' }] },
          ],
        },
      })}\n`,
    )

    await expect(installHook(target, KEEP)).rejects.toThrow(/--force/)
  })

  it('replaces that entry when --force says so, in the place it already had', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: 'bash ~/guard.sh' }] }
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(
      target.configPath,
      `${JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: 'Skill', hooks: [{ type: 'command', command: 'skill-router-nudge.sh' }] },
            mine,
          ],
        },
      })}\n`,
    )

    const outcome = await installHook(target, FORCE)
    const config = (await readJson(target.configPath)) as { hooks: { PreToolUse: unknown[] } }

    expect(outcome.action).toBe('updated')
    expect(config.hooks.PreToolUse).toHaveLength(2)
    expect(config.hooks.PreToolUse[0]).toEqual(target.entry)
    expect(config.hooks.PreToolUse[1]).toEqual(mine)
  })

  it('refuses to overwrite a script somebody changed', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await installHook(target, KEEP)
    await writeFile(target.scriptPath, '#!/usr/bin/env bash\nexit 0\n')

    await expect(installHook(target, KEEP)).rejects.toThrow(CliUsageError)
  })

  it('rewrites that script when --force says so', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await installHook(target, KEEP)
    await writeFile(target.scriptPath, '#!/usr/bin/env bash\nexit 0\n')

    const outcome = await installHook(target, FORCE)

    expect(outcome.action).toBe('updated')
    expect(await readFile(target.scriptPath, 'utf8')).toBe(CLAUDE_HOOK_SCRIPT)
  })
})

describe('installHook when it cannot use what it finds', () => {
  it('leaves a settings file that is not JSON exactly as it was', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(target.configPath, '{ not json\n')

    await expect(installHook(target, KEEP)).rejects.toThrow(CliFailureError)
    expect(await readFile(target.configPath, 'utf8')).toBe('{ not json\n')
  })

  it('refuses a "hooks" field that is not an object', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(target.configPath, `${JSON.stringify({ hooks: 'none' })}\n`)

    await expect(installHook(target, KEEP)).rejects.toThrow(CliFailureError)
  })

  it('refuses a PreToolUse field that is not a list', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(target.configPath, `${JSON.stringify({ hooks: { PreToolUse: {} } })}\n`)

    await expect(installHook(target, KEEP)).rejects.toThrow(CliFailureError)
  })

  it('never writes the script when the configuration cannot be used', async () => {
    const target = claudeHookTarget(await makeEnvironment())
    await mkdir(join(target.configPath, '..'), { recursive: true })
    await writeFile(target.configPath, '{ not json\n')

    await expect(installHook(target, KEEP)).rejects.toThrow(CliFailureError)
    expect(await exists(target.scriptPath)).toBe(false)
  })
})

describe('installHook --dry-run', () => {
  it('reports what it would write', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    const outcome = await installHook(target, PLAN)

    expect(outcome.action).toBe('planned')
    expect(outcome.summary).toContain(target.configPath)
  })

  it('writes nothing at all', async () => {
    const target = claudeHookTarget(await makeEnvironment())

    await installHook(target, PLAN)

    expect(await exists(target.scriptPath)).toBe(false)
    expect(await exists(target.configPath)).toBe(false)
  })
})

describe('install claude --hook, end to end', () => {
  /** A `jq` that exists on PATH, which is all the requirement check asks for. */
  async function withJq(environment: InstallEnvironment): Promise<InstallEnvironment> {
    const binaries = join(environment.home, 'bin')
    await mkdir(binaries, { recursive: true })
    await writeFile(join(binaries, 'jq'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    return { ...environment, path: binaries }
  }

  function dependencies(environment: InstallEnvironment): {
    deps: CliDependencies
    out: string[]
    err: string[]
  } {
    const out: string[] = []
    const err: string[] = []

    return {
      out,
      err,
      deps: {
        serve: () => Promise.resolve(),
        run: () => Promise.resolve({ code: 0, stdout: '', stderr: '' }),
        detect: () => Promise.resolve({ installed: true, evidence: 'found it' }),
        environment,
        serverCommand: ['/usr/bin/node', '/opt/skill-router/dist/bootstrap/main.js'],
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      },
    }
  }

  it('registers the server and installs the hook, reporting both', async () => {
    const environment = await withJq(await makeEnvironment())
    const { deps, out } = dependencies(environment)

    expect(await runCli(['install', 'claude', '--hook'], deps)).toBe(0)
    expect(out).toHaveLength(2)
    expect(out.join('\n')).toContain('Claude Code')
    expect(out.join('\n')).toContain('skill-router-nudge.sh')
  })

  it('leaves the files where Claude Code reads them', async () => {
    const environment = await withJq(await makeEnvironment())
    const { deps } = dependencies(environment)

    await runCli(['install', 'claude', '--hook'], deps)

    expect(await exists(join(environment.home, '.claude/hooks/skill-router-nudge.sh'))).toBe(true)
    expect(await exists(join(environment.home, '.claude/settings.json'))).toBe(true)
  })

  it('writes no hook when --hook was not asked for', async () => {
    const environment = await withJq(await makeEnvironment())
    const { deps } = dependencies(environment)

    await runCli(['install', 'claude'], deps)

    expect(await exists(join(environment.home, '.claude/settings.json'))).toBe(false)
  })

  it('writes nothing when the client is not on this machine', async () => {
    const environment = await withJq(await makeEnvironment())
    const { deps, out } = dependencies(environment)

    expect(
      await runCli(['install', 'claude', '--hook'], {
        ...deps,
        detect: () => Promise.resolve({ installed: false, evidence: 'nothing here' }),
      }),
    ).toBe(0)
    expect(out.join('\n')).toContain('Skipped')
    expect(await exists(join(environment.home, '.claude'))).toBe(false)
  })
})
