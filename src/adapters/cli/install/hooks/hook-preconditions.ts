import { findOnPath } from '../path-lookup.js'
import { CliFailureError, CliUsageError } from '../../errors.js'
import type { HookClient } from './hook-target.js'
import type { InstallClient, InstallScope } from '../../arguments.js'
import type { InstallEnvironment } from '../environment.js'

/** What the hook script uses to read the tool call and write its answer. */
const REQUIRED_EXECUTABLE = 'jq'

/**
 * Narrows a client to one that has a hook, or says why it does not.
 *
 * Runs before the machine is inspected and before anything is written, for the
 * same reason the scope check does: a command that is wrong is wrong on every
 * machine, and a setup script must not appear to work on the one where the
 * client happens to be missing.
 *
 * @throws {CliUsageError} when the client or the scope has no hook to install.
 */
export function assertHookSupported(client: InstallClient, scope: InstallScope): HookClient {
  if (client === 'opencode') {
    throw new CliUsageError(
      '--hook is not supported for opencode: it has no PreToolUse hooks, only plugins. Register the server without it.',
    )
  }

  if (scope === 'project') {
    throw new CliUsageError(
      '--hook installs a hook for this user, so it has no project scope. Re-run with --scope user.',
    )
  }

  return client
}

/**
 * Refuses to install a hook that cannot run.
 *
 * The script parses the tool call with `jq` and prints its answer with it, so
 * without `jq` every tool call would run a hook that fails. Checked before the
 * server is registered, so the whole command either happens or does not.
 *
 * @throws {CliFailureError} when `jq` is not on PATH.
 */
export async function assertHookRequirements(environment: InstallEnvironment): Promise<void> {
  if ((await findOnPath(REQUIRED_EXECUTABLE, environment)) !== null) {
    return
  }

  throw new CliFailureError(
    `${REQUIRED_EXECUTABLE} was not found on PATH, and the hook script reads every tool call with it. Install it (brew install ${REQUIRED_EXECUTABLE}, apt-get install ${REQUIRED_EXECUTABLE}) and run this again. Nothing was registered.`,
  )
}
