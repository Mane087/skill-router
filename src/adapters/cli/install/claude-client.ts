import { runAgentCliInstall } from './agent-cli.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'

const CLI = { executable: 'claude', label: 'Claude Code' }

/**
 * Registers the server with Claude Code.
 *
 * `claude mcp add <name> [options] -- <command>` takes the launch command after
 * `--`, so the name alone is not enough. Its scopes are `local`, `user` and
 * `project`; this exposes the two that are not ambiguous.
 */
export function installInClaude(
  request: InstallRequest,
  run: CommandRunner,
): Promise<InstallOutcome> {
  const add = ['mcp', 'add', request.name, '--scope', request.scope, '--', ...request.command]
  const remove = ['mcp', 'remove', request.name, '--scope', request.scope]

  return runAgentCliInstall(CLI, add, remove, request, run)
}
