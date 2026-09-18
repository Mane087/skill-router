import { install } from './install/install.js'
import { parseArguments } from './arguments.js'
import { CliFailureError, CliUsageError } from './errors.js'
import { SERVER_NAME, SERVER_VERSION } from '../mcp/server-metadata.js'
import { USAGE } from './usage.js'
import type { CommandRunner } from './command-runner.js'
import type { InstallOutcome } from './install/install-request.js'
import type { OpencodeEnvironment } from './install/opencode-client.js'

export interface CliDependencies {
  /** Starts the MCP server. Injected so the CLI can be tested without stdio. */
  readonly serve: () => Promise<void>
  readonly run: CommandRunner
  readonly environment: OpencodeEnvironment
  readonly serverCommand: readonly string[]
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

/**
 * Runs one invocation of the binary and reports the exit code.
 *
 * Returns the code rather than calling `process.exit`, so the whole surface is
 * testable and so serving is never cut short by an exit that races the
 * transport.
 *
 * Nothing but the JSON-RPC stream is ever written to stdout while serving.
 * Usage and failures go to stderr, which is also where the registry writes its
 * diagnostics.
 */
export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  try {
    const command = parseArguments(argv)

    switch (command.kind) {
      case 'serve':
        await dependencies.serve()

        return 0

      case 'help':
        dependencies.out(USAGE)

        return 0

      case 'version':
        dependencies.out(`${SERVER_NAME} ${SERVER_VERSION}`)

        return 0

      case 'install': {
        const outcome = await install(command, dependencies)

        dependencies.out(`${describeAction(outcome.action)}${outcome.summary}`)

        return 0
      }
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      dependencies.err(`${error.message}\nRun "skill-router-mcp --help".`)

      return error.exitCode
    }

    if (error instanceof CliFailureError) {
      dependencies.err(error.message)

      return error.exitCode
    }

    throw error
  }
}

/**
 * The prefix a result is reported under.
 *
 * A dry run names its own verb, because running a CLI and editing a file are
 * not the same act and a single prefix would have to be wrong for one of them.
 */
function describeAction(action: InstallOutcome['action']): string {
  switch (action) {
    case 'added':
      return 'Registered '
    case 'updated':
      return 'Replaced '
    case 'unchanged':
      return 'No change: '
    case 'planned':
      return ''
  }
}
