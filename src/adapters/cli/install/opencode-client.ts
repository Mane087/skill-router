import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { CliFailureError, CliUsageError } from '../errors.js'
import type { InstallOutcome, InstallRequest } from './install-request.js'

const CONFIG_FILENAME = 'opencode.json'
const SCHEMA_URL = 'https://opencode.ai/config.json'

export interface OpencodeEnvironment {
  readonly cwd: string
  readonly home: string
  /** `XDG_CONFIG_HOME`, when the platform sets it. */
  readonly configHome: string | undefined
}

/**
 * Registers the server with opencode by editing `opencode.json`.
 *
 * The only client whose file is written directly. `opencode mcp add` exists but
 * its options are `--url`, `--env` and `--header`: there is no way to give it
 * the command of a local server, so it prompts, and a prompt is not something
 * an install command can drive.
 *
 * The file belongs to its author, so it is merged rather than rewritten: every
 * other server and every unrelated setting survives, and an entry that already
 * exists under this name is refused unless `--force` says otherwise.
 *
 * @throws {CliUsageError} when an entry exists and replacing it was not asked for.
 * @throws {CliFailureError} when the file exists but cannot be used.
 */
export async function installInOpencode(
  request: InstallRequest,
  environment: OpencodeEnvironment,
): Promise<InstallOutcome> {
  const path = resolveConfigPath(request.scope, environment)
  const config = await readConfig(path)
  const entry = { type: 'local', command: [...request.command], enabled: true }
  const servers = readServers(config, path)
  const existing = servers[request.name]

  if (existing !== undefined && isSameEntry(existing, entry)) {
    return { action: 'unchanged', summary: `${path} already registers "${request.name}".` }
  }

  if (existing !== undefined && !request.force) {
    throw new CliUsageError(
      `${path} already registers "${request.name}" differently. Re-run with --force to replace it.`,
    )
  }

  if (request.dryRun) {
    return {
      action: 'planned',
      summary: `Would write ${path}: mcp.${request.name} = ${JSON.stringify(entry)}`,
    }
  }

  const updated = {
    $schema: SCHEMA_URL,
    ...config,
    mcp: { ...servers, [request.name]: entry },
  }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')

  return {
    action: existing === undefined ? 'added' : 'updated',
    summary: `${path}: mcp.${request.name}`,
  }
}

function resolveConfigPath(
  scope: InstallRequest['scope'],
  environment: OpencodeEnvironment,
): string {
  if (scope === 'project') {
    return join(environment.cwd, CONFIG_FILENAME)
  }

  const base = environment.configHome ?? join(environment.home, '.config')

  return join(base, 'opencode', CONFIG_FILENAME)
}

/** An absent file is not an error: it is the first install on this machine. */
async function readConfig(path: string): Promise<Record<string, unknown>> {
  let raw: string

  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return {}
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new CliFailureError(`${path} is not valid JSON, so it was left alone. ${describe(error)}`)
  }

  if (!isPlainObject(parsed)) {
    throw new CliFailureError(`${path} must contain a JSON object, so it was left alone.`)
  }

  return parsed
}

function readServers(config: Record<string, unknown>, path: string): Record<string, unknown> {
  const servers = config.mcp

  if (servers === undefined) {
    return {}
  }

  if (!isPlainObject(servers)) {
    throw new CliFailureError(
      `${path} has an "mcp" field that is not an object, so it was left alone.`,
    )
  }

  return servers
}

/**
 * Compared by serialized shape rather than field by field.
 *
 * The entry is a small literal this command writes itself, so its key order is
 * fixed, and anything a person edited by hand differs here and is therefore
 * protected instead of silently replaced.
 */
function isSameEntry(existing: unknown, entry: Record<string, unknown>): boolean {
  return JSON.stringify(existing) === JSON.stringify(entry)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
