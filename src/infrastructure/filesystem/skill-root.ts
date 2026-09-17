import { lstat, readdir } from 'node:fs/promises'
import { join, sep } from 'node:path'

import { expandHomePath } from './safe-path.js'

/** The one wildcard a root may use, and only as a whole path segment. */
export const ROOT_WILDCARD = '*'

/** Bounds a pattern expansion, so a misplaced wildcard cannot walk a disk. */
export const MAX_EXPANDED_ROOTS = 64

export interface SkillRootSpec {
  readonly path: string

  /**
   * Whether the operator asked for this root by name.
   *
   * A root written in a configuration file that does not exist is a mistake
   * worth reporting. A root this project merely assumes, such as the directory
   * another agent would use, is absent on most machines and reporting it would
   * turn every start-up into noise (ADR-0014).
   */
  readonly required: boolean
}

/** True when a root names a set of directories rather than one. */
export function isRootPattern(root: string): boolean {
  return segmentsOf(root).includes(ROOT_WILDCARD)
}

/**
 * The reason a root pattern is rejected, or null when it is usable.
 *
 * Only a whole segment may be a wildcard. Matching inside a segment, or
 * matching across them with `**`, would promise a breadth the expansion does
 * not implement, and a pattern that silently means something narrower than it
 * reads is worse than one that is refused.
 */
export function describeInvalidRootPattern(root: string): string | null {
  for (const segment of segmentsOf(root)) {
    if (segment.includes(ROOT_WILDCARD) && segment !== ROOT_WILDCARD) {
      return `"${segment}" uses ${ROOT_WILDCARD} inside a path segment; only a whole segment may be ${ROOT_WILDCARD}`
    }
  }

  return null
}

/**
 * Expands a root pattern into the directories that exist.
 *
 * Walked one segment at a time rather than read recursively: a wildcard only
 * ever lists one directory, so the cost is bounded by the pattern's own shape.
 * Hidden entries are skipped, which keeps a catalog's internal directories —
 * `.system`, `.git` — from being read as if somebody had installed them.
 *
 * An unreadable directory contributes nothing instead of failing: a pattern
 * describes what might be there, so a branch that cannot be listed is simply
 * not a match.
 *
 * Matches come back newest first, because a plugin cache keeps every version
 * it has downloaded and the first match is the one that wins a duplicate name.
 * Two directories written at the same moment are ordered by path, so a
 * registry built twice from one disk is identical.
 */
export async function expandRootPattern(
  pattern: string,
  limit: number = MAX_EXPANDED_ROOTS,
): Promise<readonly string[]> {
  const expanded = expandHomePath(pattern)
  const segments = segmentsOf(expanded)
  let matches = [leadingPathOf(expanded)]

  for (const segment of segments) {
    if (segment !== ROOT_WILDCARD) {
      matches = matches.map((match) => join(match, segment))
      continue
    }

    matches = (await Promise.all(matches.map(listDirectories))).flat()

    if (matches.length > limit) {
      matches = matches.slice(0, limit)
    }
  }

  // Only the last segment is checked for existence: an intermediate one was
  // either listed by a wildcard or is a literal whose absence makes the whole
  // pattern miss anyway.
  const present = await Promise.all(matches.map(isDirectory))

  return matches.filter((_match, index) => present[index] === true)
}

/** Whether a root exists at all, with `~` expanded and without resolving it. */
export async function rootExists(root: string): Promise<boolean> {
  return isDirectory(expandHomePath(root))
}

async function listDirectories(parent: string): Promise<string[]> {
  try {
    const entries = await readdir(parent, { withFileTypes: true })
    const directories = entries
      .filter((entry) => !entry.name.startsWith('.'))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => join(parent, entry.name))

    return await sortByNewestFirst(directories)
  } catch {
    return []
  }
}

/**
 * Newest first, ties broken by path.
 *
 * A plugin cache keeps every version it has downloaded, in directories named
 * by content hash rather than by version, so there is no order to read off the
 * name. Whichever copy was written last is the one the tool installed last,
 * and the first match of a pattern is the one that wins a duplicate name.
 *
 * This makes an expansion depend on the disk rather than on the pattern alone.
 * The alternative was serving whichever copy sorted first alphabetically,
 * which on a real cache meant a version weeks out of date (ADR-0014).
 */
async function sortByNewestFirst(paths: readonly string[]): Promise<string[]> {
  const timed = await Promise.all(
    paths.map(async (path) => ({ path, modified: await modifiedAt(path) })),
  )

  return timed
    .sort((left, right) => right.modified - left.modified || left.path.localeCompare(right.path))
    .map((entry) => entry.path)
}

async function modifiedAt(path: string): Promise<number> {
  try {
    return (await lstat(path)).mtimeMs
  } catch {
    return 0
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path)

    // A link is accepted here and judged by the path policy later, which is
    // where the decision about following links belongs (ADR-0013).
    return stats.isDirectory() || stats.isSymbolicLink()
  } catch {
    return false
  }
}

function segmentsOf(path: string): string[] {
  return path.split(sep).filter((segment) => segment.length > 0)
}

/** `/` for an absolute path, `.` for a relative one: what `join` starts from. */
function leadingPathOf(path: string): string {
  return path.startsWith(sep) ? sep : '.'
}
