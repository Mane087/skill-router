import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { canonicalizeRoot, resolveWithinRoot } from '../filesystem/safe-path.js'
import { createSkill } from '../../domain/skill/skill.js'
import { loadSkillDocument } from '../manifest/skill-manifest-loader.js'
import type { PathPolicy } from '../filesystem/safe-path.js'
import type { Skill } from '../../domain/skill/skill.js'
import type { SkillScope } from '../../domain/skill/skill-id.js'

const SKILL_FILE = 'SKILL.md'

export interface ScanLimits {
  /** Caps how many skills a single root may contribute. */
  readonly maxSkills: number
}

export interface ScannedSkill {
  readonly skill: Skill
  /** Canonical directory holding the skill, used later to resolve references. */
  readonly directory: string
}

/** A skill that was found but could not be loaded. Never silently dropped. */
export interface SkillScanDiagnostic {
  readonly path: string
  readonly reason: string
}

export interface SkillScanResult {
  readonly skills: readonly ScannedSkill[]
  readonly diagnostics: readonly SkillScanDiagnostic[]
}

/**
 * Discovers the skills directly under `root`.
 *
 * A skill is a directory containing a `SKILL.md`, and its directory name must
 * match the manifest `name`. Requiring that match keeps a skill's location
 * derivable from its id, which is what lets references be resolved later
 * without trusting a path from the manifest.
 *
 * One broken skill never fails the scan: it is reported as a diagnostic so the
 * remaining skills stay usable.
 *
 * @throws {UnsafePathError} when the root itself cannot be resolved.
 */
export async function scanSkillRoot(
  root: string,
  scope: SkillScope,
  policy: PathPolicy,
  limits: ScanLimits,
): Promise<SkillScanResult> {
  const canonicalRoot = await canonicalizeRoot(root)
  const entries = await readdir(canonicalRoot, { withFileTypes: true })

  // Sorted so the result does not depend on filesystem enumeration order.
  const candidates = entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort()

  const skills: ScannedSkill[] = []
  const diagnostics: SkillScanDiagnostic[] = []

  for (const name of candidates) {
    if (skills.length >= limits.maxSkills) {
      diagnostics.push({
        path: canonicalRoot,
        reason: `Stopped scanning at the limit of ${String(limits.maxSkills)} skills.`,
      })
      break
    }

    const relativeFile = join(name, SKILL_FILE)

    // A directory with no SKILL.md is simply not a skill, so it is skipped
    // without a diagnostic. Anything that exists but cannot be loaded is not.
    if (!(await exists(join(canonicalRoot, relativeFile)))) {
      continue
    }

    const scanned = await loadScannedSkill(canonicalRoot, name, relativeFile, scope, policy)

    if ('reason' in scanned) {
      diagnostics.push(scanned)
      continue
    }

    skills.push(scanned)
  }

  return { skills, diagnostics }
}

async function loadScannedSkill(
  canonicalRoot: string,
  directoryName: string,
  relativeFile: string,
  scope: SkillScope,
  policy: PathPolicy,
): Promise<ScannedSkill | SkillScanDiagnostic> {
  const path = join(canonicalRoot, relativeFile)

  try {
    const file = await resolveWithinRoot(canonicalRoot, relativeFile, policy)
    const { manifest } = loadSkillDocument(await readFile(file, 'utf8'))

    if (manifest.name !== directoryName) {
      return {
        path,
        reason: `Manifest name "${manifest.name}" does not match its directory "${directoryName}".`,
      }
    }

    return { skill: createSkill(scope, manifest), directory: join(canonicalRoot, directoryName) }
  } catch (error) {
    return { path, reason: describeError(error) }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
