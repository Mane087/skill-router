import { installInClaude } from '../../../../src/adapters/cli/install/claude-client.js'
import { installInCodex } from '../../../../src/adapters/cli/install/codex-client.js'
import { CliFailureError, CliUsageError } from '../../../../src/adapters/cli/errors.js'
import type { CommandResult, CommandRunner } from '../../../../src/adapters/cli/command-runner.js'
import type { InstallRequest } from '../../../../src/adapters/cli/install/install-request.js'

const COMMAND = ['node', '/opt/skill-router/dist/bootstrap/main.js']

const REQUEST: InstallRequest = {
  name: 'skill-router',
  scope: 'user',
  command: COMMAND,
  force: false,
  dryRun: false,
}

const OK: CommandResult = { code: 0, stdout: '', stderr: '' }

function recorder(...results: readonly CommandResult[]): {
  run: CommandRunner
  calls: { command: string; args: readonly string[] }[]
} {
  const calls: { command: string; args: readonly string[] }[] = []
  let index = 0

  return {
    calls,
    run: (command, args) => {
      calls.push({ command, args })
      const result = results[index] ?? OK
      index += 1

      return Promise.resolve(result)
    },
  }
}

describe('installInClaude', () => {
  it('delegates to the Claude Code CLI, which owns its own config format', async () => {
    const { run, calls } = recorder(OK)

    const outcome = await installInClaude(REQUEST, run)

    expect(calls).toEqual([
      {
        command: 'claude',
        args: ['mcp', 'add', 'skill-router', '--scope', 'user', '--', ...COMMAND],
      },
    ])
    expect(outcome.action).toBe('added')
  })

  it('passes the requested scope through', async () => {
    const { run, calls } = recorder(OK)

    await installInClaude({ ...REQUEST, scope: 'project' }, run)

    expect(calls[0]?.args).toContain('project')
  })

  it('removes the existing entry first when forced, because add does not replace', async () => {
    const { run, calls } = recorder(OK, OK)

    const outcome = await installInClaude({ ...REQUEST, force: true }, run)

    expect(calls.map((call) => call.args[1])).toEqual(['remove', 'add'])
    expect(outcome.action).toBe('updated')
  })

  it('reports an addition when the forced removal found nothing to remove', async () => {
    const { run } = recorder({ code: 1, stdout: '', stderr: 'no such server' }, OK)

    expect((await installInClaude({ ...REQUEST, force: true }, run)).action).toBe('added')
  })

  it('runs nothing on a dry run, and shows the command it would have run', async () => {
    const { run, calls } = recorder(OK)

    const outcome = await installInClaude({ ...REQUEST, dryRun: true }, run)

    expect(calls).toEqual([])
    expect(outcome.action).toBe('planned')
    expect(outcome.summary).toBe(
      `Would run: claude mcp add skill-router --scope user -- ${COMMAND.join(' ')}`,
    )
  })

  it('fails with the CLI stderr, which is where the real reason is', async () => {
    const { run } = recorder({ code: 1, stdout: '', stderr: 'already exists' })

    await expect(installInClaude(REQUEST, run)).rejects.toThrow(/already exists/)
  })

  it('says the CLI is missing rather than repeating a shell error', async () => {
    const { run } = recorder({ code: 127, stdout: '', stderr: 'spawn claude ENOENT' })

    await expect(installInClaude(REQUEST, run)).rejects.toThrow(/not found on PATH/)
  })

  it('fails as a failure, not as a usage error', async () => {
    const { run } = recorder({ code: 1, stdout: '', stderr: 'nope' })

    await expect(installInClaude(REQUEST, run)).rejects.toBeInstanceOf(CliFailureError)
  })
})

describe('installInCodex', () => {
  it('delegates to the Codex CLI', async () => {
    const { run, calls } = recorder(OK)

    const outcome = await installInCodex(REQUEST, run)

    expect(calls).toEqual([
      { command: 'codex', args: ['mcp', 'add', 'skill-router', '--', ...COMMAND] },
    ])
    expect(outcome.action).toBe('added')
  })

  it('refuses a project scope, which Codex does not have', async () => {
    const { run } = recorder(OK)

    await expect(installInCodex({ ...REQUEST, scope: 'project' }, run)).rejects.toBeInstanceOf(
      CliUsageError,
    )
  })

  it('names the file Codex actually writes, so the refusal is not a dead end', async () => {
    const { run } = recorder(OK)

    await expect(installInCodex({ ...REQUEST, scope: 'project' }, run)).rejects.toThrow(
      /config\.toml/,
    )
  })

  it('removes the existing entry first when forced', async () => {
    const { run, calls } = recorder(OK, OK)

    const outcome = await installInCodex({ ...REQUEST, force: true }, run)

    expect(calls.map((call) => call.args[1])).toEqual(['remove', 'add'])
    expect(outcome.action).toBe('updated')
  })

  it('runs nothing on a dry run', async () => {
    const { run, calls } = recorder(OK)

    expect((await installInCodex({ ...REQUEST, dryRun: true }, run)).action).toBe('planned')
    expect(calls).toEqual([])
  })

  it('says the CLI is missing when it is not on PATH', async () => {
    const { run } = recorder({ code: 127, stdout: '', stderr: 'spawn codex ENOENT' })

    await expect(installInCodex(REQUEST, run)).rejects.toThrow(/not found on PATH/)
  })
})
