import { install } from '../../../../src/adapters/cli/install/install.js'
import { CliUsageError } from '../../../../src/adapters/cli/errors.js'
import type { InstallCommand } from '../../../../src/adapters/cli/arguments.js'
import type { ClientDetector } from '../../../../src/adapters/cli/install/client-presence.js'
import type { CommandRunner } from '../../../../src/adapters/cli/command-runner.js'
import type { InstallDependencies } from '../../../../src/adapters/cli/install/install.js'
import type { InstallOutcome } from '../../../../src/adapters/cli/install/install-request.js'

const COMMAND: InstallCommand = {
  kind: 'install',
  client: 'claude',
  name: 'skill-router',
  scope: 'user',
  force: false,
  dryRun: false,
  hook: false,
  skill: false,
}

/** Every install but one reports a single outcome; this keeps the reading of it honest. */
function only(outcomes: readonly InstallOutcome[]): InstallOutcome {
  expect(outcomes).toHaveLength(1)

  return outcomes[0]!
}

function dependencies(
  installed: boolean,
  run: CommandRunner = () => Promise.resolve({ code: 0, stdout: '', stderr: '' }),
): { deps: InstallDependencies; detected: string[] } {
  const detected: string[] = []

  const detect: ClientDetector = (client) => {
    detected.push(client)

    return Promise.resolve(
      installed
        ? { installed: true, evidence: 'found /home/someone/.claude' }
        : {
            installed: false,
            evidence: 'Looked for /home/someone/.claude and for "claude" on PATH.',
          },
    )
  }

  return {
    detected,
    deps: {
      run,
      detect,
      environment: {
        cwd: '/workspace',
        home: '/home/someone',
        configHome: undefined,
        codexHome: undefined,
        path: undefined,
        pathExtensions: undefined,
      },
      serverCommand: ['/usr/bin/node', '/opt/skill-router/dist/bootstrap/main.js'],
    },
  }
}

describe('install on a machine that does not have the client', () => {
  it('skips instead of failing, so a setup script survives a client nobody uses', async () => {
    const { deps } = dependencies(false)

    expect(only(await install(COMMAND, deps)).action).toBe('skipped')
  })

  it('names the client and everywhere it looked', async () => {
    const { deps } = dependencies(false)

    const outcome = only(await install(COMMAND, deps))

    expect(outcome.summary).toContain('claude is not installed')
    expect(outcome.summary).toContain('/home/someone/.claude')
  })

  it('runs no command, because there is nothing there to run', async () => {
    const calls: string[] = []
    const { deps } = dependencies(false, (command) => {
      calls.push(command)

      return Promise.resolve({ code: 0, stdout: '', stderr: '' })
    })

    await install(COMMAND, deps)

    expect(calls).toEqual([])
  })

  it('writes no opencode configuration either', async () => {
    const { deps } = dependencies(false)

    // A write would need a real path; reaching one would throw rather than skip.
    const outcome = only(await install({ ...COMMAND, client: 'opencode' }, deps))

    expect(outcome.action).toBe('skipped')
  })

  it('skips a dry run too, since the answer does not depend on writing anything', async () => {
    const { deps } = dependencies(false)

    expect(only(await install({ ...COMMAND, dryRun: true }, deps)).action).toBe('skipped')
  })
})

describe('install on a machine that has the client', () => {
  it('carries the registration out', async () => {
    const calls: string[][] = []
    const { deps } = dependencies(true, (command, args) => {
      calls.push([command, ...args])

      return Promise.resolve({ code: 0, stdout: '', stderr: '' })
    })

    expect(only(await install(COMMAND, deps)).action).toBe('added')
    expect(calls[0]?.[0]).toBe('claude')
  })

  it('asks about the client it was told to install, not about another', async () => {
    const { detected, deps } = dependencies(true)

    await install({ ...COMMAND, client: 'codex' }, deps)

    expect(detected).toEqual(['codex'])
  })
})

describe('install --hook before it touches anything', () => {
  it('refuses a client that has no hook before inspecting the machine', async () => {
    const { detected, deps } = dependencies(true)

    await expect(install({ ...COMMAND, client: 'opencode', hook: true }, deps)).rejects.toThrow(
      CliUsageError,
    )
    expect(detected).toEqual([])
  })

  it('refuses a missing requirement before inspecting the machine', async () => {
    const { detected, deps } = dependencies(true)

    // No PATH, so jq cannot be found, which is what a machine without it looks like.
    await expect(install({ ...COMMAND, hook: true }, deps)).rejects.toThrow(/jq/)
    expect(detected).toEqual([])
  })
})

describe('install and scopes a client does not have', () => {
  it('refuses a project scope for Codex', async () => {
    const { deps } = dependencies(true)

    await expect(install({ ...COMMAND, client: 'codex', scope: 'project' }, deps)).rejects.toThrow(
      CliUsageError,
    )
  })

  it('names the file Codex actually writes, so the refusal is not a dead end', async () => {
    const { deps } = dependencies(true)

    await expect(install({ ...COMMAND, client: 'codex', scope: 'project' }, deps)).rejects.toThrow(
      /config\.toml/,
    )
  })

  it('refuses before inspecting the machine, so the command fails the same way everywhere', async () => {
    const { detected, deps } = dependencies(false)

    await expect(install({ ...COMMAND, client: 'codex', scope: 'project' }, deps)).rejects.toThrow()

    expect(detected).toEqual([])
  })
})

describe('install --skill', () => {
  /**
   * Planned rather than written: this suite runs against a made-up home
   * directory, and an installer that writes would put a skill in it.
   */
  const PLAN = { ...COMMAND, skill: true, dryRun: true }

  it('reports the registration and the skill, in that order', async () => {
    const { deps } = dependencies(true)

    const outcomes = await install(PLAN, deps)

    expect(outcomes).toHaveLength(2)
    expect(outcomes[1]!.summary).toContain('skill-router-metadata')
  })

  it('is supported on opencode, which has no hook to install', async () => {
    const { deps } = dependencies(true)

    const outcomes = await install({ ...PLAN, client: 'opencode' }, deps)

    expect(outcomes).toHaveLength(2)
    expect(outcomes[1]!.action).toBe('planned')
  })

  it('does not reach the skill when the client is not on this machine', async () => {
    const { deps } = dependencies(false)

    expect(only(await install(PLAN, deps)).action).toBe('skipped')
  })

  it('takes the global directory whatever the scope of the registration', async () => {
    const { deps } = dependencies(true)

    const outcomes = await install({ ...PLAN, scope: 'project' }, deps)

    expect(outcomes[1]!.summary).toContain('/home/someone')
    expect(outcomes[1]!.summary).not.toContain('/workspace')
  })
})
