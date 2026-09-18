import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import type { InstallEnvironment } from './environment.js'

/** Windows decides what is executable by extension, not by a permission bit. */
const DEFAULT_WINDOWS_EXTENSIONS = '.COM;.EXE;.BAT;.CMD'

/**
 * Resolves an executable the way a shell would.
 *
 * Written out rather than delegated to a spawn: asking the operating system to
 * run something in order to find out whether it exists runs it.
 *
 * Shared by the client detector and the hook's requirement check, which ask the
 * same question about different programs and must answer it the same way: an
 * empty PATH is "not found", never an error, because a process started by a
 * desktop application can have one.
 */
export async function findOnPath(
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
