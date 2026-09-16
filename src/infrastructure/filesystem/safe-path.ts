import { realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'

import { UnsafePathError } from '../../domain/errors.js'

export interface PathPolicy {
  /**
   * When false, any path reached through a symbolic link is rejected, even one
   * that stays inside the root. The plan's default configuration sets it false.
   */
  readonly followSymlinks: boolean
}

const NULL_BYTE = String.fromCharCode(0)

/**
 * Resolves a configured root to its canonical location, once, at startup.
 *
 * The root itself may be a symlink (`/tmp` is one on macOS), so every later
 * containment check compares against this resolved form rather than the
 * configured string.
 *
 * @throws {UnsafePathError} when the root cannot be resolved.
 */
export async function canonicalizeRoot(root: string): Promise<string> {
  const expanded = expandHome(root)

  try {
    return await realpath(expanded)
  } catch (error) {
    throw new UnsafePathError(`Skill root is not accessible: ${expanded}. ${describeError(error)}`)
  }
}

/**
 * Resolves `relativePath` under an already canonical root, refusing anything
 * that escapes it.
 *
 * Containment is checked twice: once on the lexical join, which rejects `..`
 * before the filesystem is touched, and once on the real path, which is what
 * catches a symlink pointing outside.
 *
 * Known limitation: this is a check-then-use sequence. A link swapped between
 * the check and the subsequent read would defeat it. Closing that gap needs
 * `O_NOFOLLOW` file descriptors, which Node does not expose portably; the
 * default policy of refusing symlinks outright is the mitigation.
 *
 * @throws {UnsafePathError} when the path escapes the root, violates the
 * symlink policy, or does not exist.
 */
export async function resolveWithinRoot(
  canonicalRoot: string,
  relativePath: string,
  policy: PathPolicy,
): Promise<string> {
  if (relativePath.includes(NULL_BYTE)) {
    throw new UnsafePathError('Path must not contain a null byte.')
  }

  if (isAbsolute(relativePath)) {
    throw new UnsafePathError(`Path must be relative to the skill root: ${relativePath}`)
  }

  const joined = resolve(canonicalRoot, relativePath)

  if (!isInside(joined, canonicalRoot)) {
    throw new UnsafePathError(`Path escapes the skill root: ${relativePath}`)
  }

  const real = await resolveReal(joined, relativePath)

  // A real path differing from the lexical join means some component was a
  // symbolic link, since the root is already canonical.
  if (!policy.followSymlinks && real !== joined) {
    throw new UnsafePathError(`Path is reached through a symbolic link: ${relativePath}`)
  }

  if (!isInside(real, canonicalRoot)) {
    throw new UnsafePathError(`Path resolves outside the skill root: ${relativePath}`)
  }

  return real
}

async function resolveReal(candidate: string, relativePath: string): Promise<string> {
  try {
    return await realpath(candidate)
  } catch (error) {
    throw new UnsafePathError(`Path cannot be resolved: ${relativePath}. ${describeError(error)}`)
  }
}

function isInside(candidate: string, root: string): boolean {
  // The separator matters: without it "/srv/roots-evil" counts as inside "/srv/root".
  return candidate === root || candidate.startsWith(root + sep)
}

function expandHome(value: string): string {
  if (value === '~') {
    return homedir()
  }

  return value.startsWith(`~${sep}`) ? join(homedir(), value.slice(2)) : value
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
