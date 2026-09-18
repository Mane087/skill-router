import { CliUsageError } from './errors.js'

export const INSTALL_CLIENTS = ['claude', 'codex', 'opencode'] as const
export type InstallClient = (typeof INSTALL_CLIENTS)[number]

export const INSTALL_SCOPES = ['user', 'project'] as const
export type InstallScope = (typeof INSTALL_SCOPES)[number]

/** The name the server is registered under, unless `--name` says otherwise. */
export const DEFAULT_SERVER_NAME = 'skill-router'

export interface InstallCommand {
  readonly kind: 'install'
  readonly client: InstallClient
  readonly name: string
  readonly scope: InstallScope
  readonly force: boolean
  readonly dryRun: boolean
}

export type CliCommand =
  | { readonly kind: 'serve' }
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | InstallCommand

/**
 * Turns `process.argv` into a command.
 *
 * Hand-written rather than delegated to a parser library: the surface is four
 * options wide, and a dependency that runs before the server starts is a
 * dependency in the trust boundary of every agent that launches it.
 *
 * No argument means `serve`, because that is how an MCP client launches the
 * binary. Anything unrecognized fails rather than falling back to serving: a
 * typo that silently starts a server would leave the caller waiting on a
 * JSON-RPC stream that never answers what they meant to ask.
 *
 * @throws {CliUsageError} when the command line cannot be carried out.
 */
export function parseArguments(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv

  if (command === undefined || command === 'serve') {
    return { kind: 'serve' }
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    return { kind: 'help' }
  }

  if (command === '--version' || command === '-v') {
    return { kind: 'version' }
  }

  if (command === 'install') {
    return parseInstall(rest)
  }

  throw new CliUsageError(`Unknown command "${command}". Run "skill-router-mcp --help".`)
}

function parseInstall(argv: readonly string[]): InstallCommand {
  let client: InstallClient | undefined
  let name = DEFAULT_SERVER_NAME
  let scope: InstallScope = 'user'
  let force = false
  let dryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? ''

    if (!argument.startsWith('-')) {
      if (client !== undefined) {
        throw new CliUsageError(`Unexpected argument "${argument}". Install takes one client.`)
      }

      client = asClient(argument)
      continue
    }

    const [flag, inlineValue] = splitFlag(argument)

    switch (flag) {
      case '--force':
        force = true
        break
      case '--dry-run':
        dryRun = true
        break
      case '--name':
        name = requireNonEmpty(flag, readValue(flag, inlineValue, argv, index))
        index += inlineValue === undefined ? 1 : 0
        break
      case '--scope':
        scope = asScope(readValue(flag, inlineValue, argv, index))
        index += inlineValue === undefined ? 1 : 0
        break
      default:
        throw new CliUsageError(`Unknown option "${flag}" for install.`)
    }
  }

  if (client === undefined) {
    throw new CliUsageError(`Install needs a client: ${INSTALL_CLIENTS.join(', ')}.`)
  }

  return { kind: 'install', client, name, scope, force, dryRun }
}

/** Splits `--name=value`, which is as valid as `--name value`. */
function splitFlag(argument: string): [string, string | undefined] {
  const separator = argument.indexOf('=')

  return separator === -1
    ? [argument, undefined]
    : [argument.slice(0, separator), argument.slice(separator + 1)]
}

function readValue(
  flag: string,
  inlineValue: string | undefined,
  argv: readonly string[],
  index: number,
): string {
  const value = inlineValue ?? argv[index + 1]

  if (value === undefined || value.startsWith('-')) {
    throw new CliUsageError(`Option "${flag}" needs a value.`)
  }

  return value
}

function requireNonEmpty(flag: string, value: string): string {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new CliUsageError(`Option "${flag}" needs a value.`)
  }

  return trimmed
}

function asClient(value: string): InstallClient {
  const client = INSTALL_CLIENTS.find((candidate) => candidate === value)

  if (client === undefined) {
    throw new CliUsageError(`Unknown client "${value}". Supported: ${INSTALL_CLIENTS.join(', ')}.`)
  }

  return client
}

function asScope(value: string): InstallScope {
  const scope = INSTALL_SCOPES.find((candidate) => candidate === value)

  if (scope === undefined) {
    throw new CliUsageError(`Unknown scope "${value}". Supported: ${INSTALL_SCOPES.join(', ')}.`)
  }

  return scope
}
