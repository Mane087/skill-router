import { CliUsageError } from '../errors.js'
import type { InstallClient, InstallScope } from '../arguments.js'

/**
 * Rejects a scope a client does not have.
 *
 * Runs before the machine is inspected, so a command that is wrong is wrong
 * everywhere: a script that works on one developer's machine must not silently
 * do nothing on another's because the client happened to be missing there.
 *
 * @throws {CliUsageError} when the client has no such scope.
 */
export function assertScopeSupported(client: InstallClient, scope: InstallScope): void {
  if (client === 'codex' && scope === 'project') {
    throw new CliUsageError(
      'Codex has no project scope: it keeps every MCP server in ~/.codex/config.toml. Install it with --scope user.',
    )
  }
}
