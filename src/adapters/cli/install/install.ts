import { installInClaude } from './claude-client.js'
import { installInCodex } from './codex-client.js'
import { installInOpencode } from './opencode-client.js'
import type { InstallCommand } from '../arguments.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'
import type { OpencodeEnvironment } from './opencode-client.js'

export interface InstallDependencies {
  readonly run: CommandRunner
  readonly environment: OpencodeEnvironment
  /** What the client should run to launch this server. */
  readonly serverCommand: readonly string[]
}

/**
 * Registers this server with one agent client.
 *
 * Two of the three clients are asked to do it through their own CLI, and the
 * third has its configuration file merged, because it offers no other way. The
 * asymmetry is in the clients, not in this project, so it is kept visible here
 * rather than hidden behind a uniform abstraction that would have to lie about
 * one of them.
 */
export async function install(
  command: InstallCommand,
  dependencies: InstallDependencies,
): Promise<InstallOutcome> {
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
