import { install } from '../../../../src/adapters/cli/install/install.js'
import { CliUsageError } from '../../../../src/adapters/cli/errors.js'
import type { InstallCommand } from '../../../../src/adapters/cli/arguments.js'
import type { ClientDetector } from '../../../../src/adapters/cli/install/client-presence.js'
import type { CommandRunner } from '../../../../src/adapters/cli/command-runner.js'
import type { InstallDependencies } from '../../../../src/adapters/cli/install/install.js'

const COMMAND: InstallCommand = {
  kind: 'install',
  client: 'claude',
  name: 'skill-router',
  scope: 'user',
  force: false,
  dryRun: false,
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

    expect((await install(COMMAND, deps)).action).toBe('skipped')
  })

  it('names the client and everywhere it looked', async () => {
    const { deps } = dependencies(false)

    const outcome = await install(COMMAND, deps)

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
    const outcome = await install({ ...COMMAND, client: 'opencode' }, deps)

    expect(outcome.action).toBe('skipped')
  })

  it('skips a dry run too, since the answer does not depend on writing anything', async () => {
    const { deps } = dependencies(false)

    expect((await install({ ...COMMAND, dryRun: true }, deps)).action).toBe('skipped')
  })
})

describe('install on a machine that has the client', () => {
  it('carries the registration out', async () => {
    const calls: string[][] = []
    const { deps } = dependencies(true, (command, args) => {
      calls.push([command, ...args])

      return Promise.resolve({ code: 0, stdout: '', stderr: '' })
    })

    expect((await install(COMMAND, deps)).action).toBe('added')
    expect(calls[0]?.[0]).toBe('claude')
  })

  it('asks about the client it was told to install, not about another', async () => {
    const { detected, deps } = dependencies(true)

    await install({ ...COMMAND, client: 'codex' }, deps)

    expect(detected).toEqual(['codex'])
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
