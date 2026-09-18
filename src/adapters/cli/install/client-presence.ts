import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import type { InstallClient } from '../arguments.js'
import type { InstallEnvironment } from './environment.js'

export interface ClientPresence {
  readonly installed: boolean
  /** What proved it, or every place that was looked at. */
  readonly evidence: string
}

/**
 * Decides whether a client is on this machine.
 *
 * A port, so the command that dispatches on the answer can be tested without a
 * home directory to stage.
 */
export type ClientDetector = (
  client: InstallClient,
  environment: InstallEnvironment,
) => Promise<ClientPresence>

/** Windows decides what is executable by extension, not by a permission bit. */
const DEFAULT_WINDOWS_EXTENSIONS = '.COM;.EXE;.BAT;.CMD'

/**
 * Where each client keeps its state, relative to the home directory.
 *
 * opencode has two: `~/.opencode` holds the installation and `~/.config/opencode`
 * holds the configuration, and a machine can have either without the other.
 */
const CLIENT_DIRECTORIES: Record<InstallClient, readonly string[]> = {
  claude: ['.claude'],
  codex: ['.codex'],
  opencode: ['.opencode'],
}

/**
 * Decides whether a client is present on this machine.
 *
 * Two signals, because each one alone is wrong in a case that happens:
 *
 * - **Its directory.** A client that has been used has one. A client that is
 *   installed but has never been run does not, so the directory alone would
 *   skip an install that would have worked.
 * - **Its executable on PATH.** Present from the moment it is installed. But a
 *   client can be on the machine while this process has a PATH that does not
 *   include it, which is routine when an editor or a launcher starts the shell.
 *
 * Either is enough. Neither means the client is not here, and the install is
 * skipped rather than failed: running the three install commands on a machine
 * that has one of the three is a setup script, not a mistake.
 */
export async function detectClient(
  client: InstallClient,
  environment: InstallEnvironment,
): Promise<ClientPresence> {
  const directories = clientDirectories(client, environment)

  for (const directory of directories) {
    if (await isDirectory(directory)) {
      return { installed: true, evidence: `found ${directory}` }
    }
  }

  const executable = await findOnPath(client, environment)

  if (executable !== null) {
    return { installed: true, evidence: `found ${client} on PATH at ${executable}` }
  }

  return {
    installed: false,
    evidence: `Looked for ${directories.join(', ')} and for "${client}" on PATH.`,
  }
}

/** Every directory whose existence means this client is on the machine. */
export function clientDirectories(
  client: InstallClient,
  environment: InstallEnvironment,
): readonly string[] {
  const directories = CLIENT_DIRECTORIES[client].map((name) => join(environment.home, name))

  if (client !== 'opencode') {
    return directories
  }

  const configBase = environment.configHome ?? join(environment.home, '.config')

  return [...directories, join(configBase, 'opencode')]
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Resolves an executable the way a shell would.
 *
 * Written out rather than delegated to a spawn: asking the operating system to
 * run something in order to find out whether it exists runs it.
 */
async function findOnPath(
  executable: string,
  environment: InstallEnvironment,
): Promise<string | null> {
  if (environment.path === undefined || environment.path.length === 0) {
    return null
  }

  const extensions =
    process.platform === 'win32'
      ? (environment.pathExtensions ?? DEFAULT_WINDOWS_EXTENSIONS).split(';')
      : ['']

  for (const directory of environment.path.split(delimiter)) {
    if (directory.length === 0) {
      continue
    }

    for (const extension of extensions) {
      const candidate = join(directory, `${executable}${extension}`)

      if (await isExecutable(candidate)) {
        return candidate
      }
    }
  }

  return null
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)

    return true
  } catch {
    return false
  }
}
