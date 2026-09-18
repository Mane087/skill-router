import { assertScopeSupported } from './scopes.js'
import { claudeHookTarget } from './hooks/claude-hook.js'
import { codexHookTarget } from './hooks/codex-hook.js'
import { installHook } from './hooks/hook-installer.js'
import { assertHookRequirements, assertHookSupported } from './hooks/hook-preconditions.js'
import { installInClaude } from './claude-client.js'
import { installInCodex } from './codex-client.js'
import { installInOpencode } from './opencode-client.js'
import { installSkill } from './skill/skill-installer.js'
import { skillTarget } from './skill/skill-target.js'
import type { HookClient, HookTarget } from './hooks/hook-target.js'
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
 * Registers this server with one agent client, and optionally installs the hook.
 *
 * Everything that can be decided without the machine is decided first: the
 * scope, whether this client has a hook at all, and whether the hook's
 * requirements are met. A command that is wrong is wrong everywhere, and a
 * missing requirement found halfway through would leave a server registered
 * against a hook that was never written.
 *
 * Then the machine is inspected: a client that is not installed is skipped
 * rather than failed, so running all three install commands on a machine that
 * has one of them is a setup script and not an error. Only then is anything
 * written.
 *
 * Two of the three clients are asked to register the server through their own
 * CLI, and the third has its configuration file merged, because it offers no
 * other way. The asymmetry is in the clients, not in this project, so it is
 * kept visible here rather than hidden behind a uniform abstraction that would
 * have to lie about one of them.
 *
 * Returns one outcome per thing that was touched, because `--hook` and
 * `--skill` make this up to three acts that can land differently: a
 * registration that was already there, a hook that was not, and a skill that
 * was installed by an earlier version.
 */
export async function install(
  command: InstallCommand,
  dependencies: InstallDependencies,
): Promise<readonly InstallOutcome[]> {
  assertScopeSupported(command.client, command.scope)

  const hookClient = command.hook ? assertHookSupported(command.client, command.scope) : undefined

  if (hookClient !== undefined) {
    await assertHookRequirements(dependencies.environment)
  }

  const presence = await dependencies.detect(command.client, dependencies.environment)

  if (!presence.installed) {
    return [
      {
        action: 'skipped',
        summary: `${command.client} is not installed on this machine. ${presence.evidence}`,
      },
    ]
  }

  const outcomes = [await registerServer(command, dependencies)]

  if (hookClient !== undefined) {
    outcomes.push(await installHook(hookTarget(hookClient, dependencies.environment), command))
  }

  // Last, and after the registration, so the order the outcomes are printed in
  // is the order the agent meets them: it finds the server, then the hook that
  // points at it, then the skill that fills the catalogue the server ranks.
  if (command.skill) {
    outcomes.push(
      await installSkill(skillTarget(command.client, dependencies.environment), command),
    )
  }

  return outcomes
}

function registerServer(
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
      return installInClaude(request, dependencies.run)
    case 'codex':
      return installInCodex(request, dependencies.run)
    case 'opencode':
      return installInOpencode(request, dependencies.environment)
  }
}

function hookTarget(client: HookClient, environment: InstallEnvironment): HookTarget {
  return client === 'claude' ? claudeHookTarget(environment) : codexHookTarget(environment)
}
