import { assertScopeSupported } from './scopes.js'
import { installInClaude } from './claude-client.js'
import { installInCodex } from './codex-client.js'
import { installInOpencode } from './opencode-client.js'
import type { InstallCommand } from '../arguments.js'
import type { ClientDetector } from './client-presence.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallEnvironment } from './environment.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'

export interface InstallDependencies {
  readonly run: CommandRunner
  readonly detect: ClientDetector
  readonly environment: InstallEnvironment
  /** What the client should run to launch this server. */
  readonly serverCommand: readonly string[]
}

/**
 * Registers this server with one agent client.
 *
 * Three steps, in an order that matters. The scope is checked first, because a
 * command that is wrong is wrong on every machine. Then the machine is
 * inspected: a client that is not installed is skipped rather than failed, so
 * running all three install commands on a machine that has one of them is a
 * setup script and not an error. Only then is anything written.
 *
 * Two of the three clients are asked to register the server through their own
 * CLI, and the third has its configuration file merged, because it offers no
 * other way. The asymmetry is in the clients, not in this project, so it is
 * kept visible here rather than hidden behind a uniform abstraction that would
 * have to lie about one of them.
 */
export async function install(
  command: InstallCommand,
  dependencies: InstallDependencies,
): Promise<InstallOutcome> {
  assertScopeSupported(command.client, command.scope)

  const presence = await dependencies.detect(command.client, dependencies.environment)

  if (!presence.installed) {
    return {
      action: 'skipped',
      summary: `${command.client} is not installed on this machine. ${presence.evidence}`,
    }
  }

  const request: InstallRequest = {
    name: command.name,
    scope: command.scope,
    command: dependencies.serverCommand,
    force: command.force,
    dryRun: command.dryRun,
  }

  switch (command.client) {
    case 'claude':
      return await installInClaude(request, dependencies.run)
    case 'codex':
      return await installInCodex(request, dependencies.run)
    case 'opencode':
      return await installInOpencode(request, dependencies.environment)
  }
}
