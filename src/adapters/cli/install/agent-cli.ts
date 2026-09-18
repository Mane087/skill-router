import { COMMAND_NOT_FOUND } from '../command-runner.js'
import { CliFailureError } from '../errors.js'
import type { CommandRunner } from '../command-runner.js'
import type { InstallOutcome } from './install-request.js'

export interface AgentCli {
  /** The executable, as it is spelled on PATH. */
  readonly executable: string
  /** How it is called in a message to a person. */
  readonly label: string
}

/**
 * Registers a server by running the client's own CLI.
 *
 * Shelling out rather than writing the configuration file directly: Claude Code
 * and Codex each own their format, both have moved it before, and a file
 * written behind their back is a file they may rewrite without warning. The one
 * client that gets its file edited is opencode, which offers no non-interactive
 * way to add a local server.
 */
export async function runAgentCliInstall(
  cli: AgentCli,
  addArguments: readonly string[],
  removeArguments: readonly string[],
  options: { readonly force: boolean; readonly dryRun: boolean },
  run: CommandRunner,
): Promise<InstallOutcome> {
  if (options.dryRun) {
    return {
      action: 'planned',
      summary: `Would run: ${cli.executable} ${addArguments.join(' ')}`,
    }
  }

  // `add` does not replace an existing entry in either CLI, so a forced install
  // removes first. A removal that finds nothing simply means there was nothing
  // to replace, which is an addition and not a failure.
  const replaced = options.force && (await run(cli.executable, removeArguments)).code === 0

  const result = await run(cli.executable, addArguments)

  if (result.code === COMMAND_NOT_FOUND) {
    throw new CliFailureError(
      `${cli.label} was not found on PATH. Install it, or register the server yourself with: ${cli.executable} ${addArguments.join(' ')}`,
    )
  }

  if (result.code !== 0) {
    throw new CliFailureError(
      `${cli.label} refused the registration (exit ${String(result.code)}). ${describe(result.stderr, result.stdout)}`,
    )
  }

  return {
    action: replaced ? 'updated' : 'added',
    summary: `${cli.label}: ${addArguments.join(' ')}`,
  }
}

function describe(stderr: string, stdout: string): string {
  const output = stderr.trim().length > 0 ? stderr : stdout

  return output.trim().length > 0 ? output.trim() : 'It reported nothing.'
}
