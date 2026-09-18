import { runAgentCliInstall } from './agent-cli.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'

const CLI = { executable: 'codex', label: 'Codex' }

/**
 * Registers the server with Codex.
 *
 * `codex mcp add <NAME> -- <COMMAND>...` takes the launch command after `--`.
 *
 * Codex has no per-project configuration, so a project scope is refused before
 * this is reached: see `assertScopeSupported`, which runs on every client and
 * before the machine is inspected, so a malformed command fails the same way
 * everywhere rather than depending on what happens to be installed.
 */
export async function installInCodex(
  request: InstallRequest,
  run: CommandRunner,
): Promise<InstallOutcome> {
  const add = ['mcp', 'add', request.name, '--', ...request.command]
  const remove = ['mcp', 'remove', request.name]

  return await runAgentCliInstall(CLI, add, remove, request, run)
}
