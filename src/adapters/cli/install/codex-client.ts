import { runAgentCliInstall } from './agent-cli.js'
import { CliUsageError } from '../errors.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'

const CLI = { executable: 'codex', label: 'Codex' }

/**
 * Registers the server with Codex.
 *
 * `codex mcp add <NAME> -- <COMMAND>...` takes the launch command after `--`.
 * Codex keeps every MCP server in `~/.codex/config.toml` and has no per-project
 * configuration, so a project scope is refused rather than silently widened to
 * the whole machine.
 *
 * Async even where it refuses, so every failure reaches the caller the same
 * way: a synchronous throw from a function that returns a promise is a trap.
 */
export async function installInCodex(
  request: InstallRequest,
  run: CommandRunner,
): Promise<InstallOutcome> {
  if (request.scope === 'project') {
    throw new CliUsageError(
      'Codex has no project scope: it keeps every MCP server in ~/.codex/config.toml. Install it with --scope user.',
    )
  }

  const add = ['mcp', 'add', request.name, '--', ...request.command]
  const remove = ['mcp', 'remove', request.name]

  return await runAgentCliInstall(CLI, add, remove, request, run)
}
