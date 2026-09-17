import { createInMemorySkillRepository } from './in-memory-skill-repository.js'
import { scanSkillRoot } from './skill-scanner.js'
import { formatSkillId } from '../../domain/skill/skill-id.js'
import { canonicalizeRoot } from '../filesystem/safe-path.js'
import { expandRootPattern, isRootPattern, rootExists } from '../filesystem/skill-root.js'
import type { ScanLimits, ScannedSkill, SkillScanDiagnostic } from './skill-scanner.js'
import type { PathPolicy } from '../filesystem/safe-path.js'
import type { SkillRootSpec } from '../filesystem/skill-root.js'
import type { SkillRepository } from '../../application/ports/skill-repository.js'
import type { SkillScope } from '../../domain/skill/skill-id.js'

export interface SkillRoots {
  readonly global: readonly SkillRootSpec[]
  readonly project: readonly SkillRootSpec[]
}

export interface RegistryOptions {
  readonly roots: SkillRoots
  readonly policy: PathPolicy
  readonly limits: ScanLimits
}

export type RegistryDiagnostic = SkillScanDiagnostic

export interface SkillRegistry {
  readonly repository: SkillRepository
  /**
   * Discovered skills with the directory each one lives in. Kept alongside the
   * repository because resolving a reference later needs the location, which
   * the repository port deliberately does not expose.
   */
  readonly entries: readonly ScannedSkill[]
  readonly diagnostics: readonly RegistryDiagnostic[]
}

/**
 * Scans every configured root and indexes what it finds.
 *
 * A missing root is reported, not thrown: a user without a global skills
 * directory should still get their project skills. A root the project only
 * assumed is not even reported, since most machines have most of them absent
 * (ADR-0014), and a root written as a pattern stands for whatever exists.
 *
 * Scope is part of a skill's identity, so `global:angular` and
 * `project:angular` coexist. Within one scope the first root wins, and the
 * shadowed copy is reported rather than dropped silently — unless it came from
 * a pattern, where holding several copies is what a cache is for and the
 * newest one is already the one that won (ADR-0014).
 */
export async function buildSkillRegistry(options: RegistryOptions): Promise<SkillRegistry> {
  const entries: ScannedSkill[] = []
  const diagnostics: RegistryDiagnostic[] = []
  const seen = new Set<string>()
  const scanned = new Set<string>()

  for (const { scope, spec } of enumerateRoots(options.roots)) {
    // A pattern stands for whatever is installed, so a name it provides twice
    // is the shape of a cache rather than a conflict anybody chose.
    const expanded = isRootPattern(spec.path)

    for (const root of await locateRoots(spec)) {
      // Interoperability between agents is built out of links, so several of
      // the known roots are routinely one directory. Scanning it once per name
      // would report every skill it holds as a duplicate of itself.
      if (await alreadyScanned(root, scope, scanned)) {
        continue
      }

      const result = await scanRoot(root, scope, options)

      if ('reason' in result) {
        diagnostics.push(result)
        continue
      }

      diagnostics.push(...result.diagnostics)

      for (const entry of result.skills) {
        const key = formatSkillId(entry.skill.id)

        if (seen.has(key)) {
          if (!expanded) {
            diagnostics.push({
              path: entry.directory,
              reason: `Duplicate skill ${key} ignored: an earlier root already provides it.`,
            })
          }

          continue
        }

        seen.add(key)
        entries.push(entry)
      }
    }
  }

  return {
    repository: createInMemorySkillRepository(entries),
    entries,
    diagnostics,
  }
}

function* enumerateRoots(roots: SkillRoots): Generator<{ scope: SkillScope; spec: SkillRootSpec }> {
  for (const spec of roots.global) {
    yield { scope: 'global', spec }
  }

  for (const spec of roots.project) {
    yield { scope: 'project', spec }
  }
}

/**
 * The directories one configured root stands for.
 *
 * A pattern becomes whatever exists, which may be nothing: it describes a
 * layout that might be installed, so an empty expansion is an answer rather
 * than a fault.
 *
 * A plain root that is absent is dropped here only when the project assumed
 * it. One the operator wrote is left to the scan, which reports why it could
 * not be read (ADR-0014).
 */
async function locateRoots(spec: SkillRootSpec): Promise<readonly string[]> {
  if (isRootPattern(spec.path)) {
    return expandRootPattern(spec.path)
  }

  if (!spec.required && !(await rootExists(spec.path))) {
    return []
  }

  return [spec.path]
}

/**
 * Whether this directory has already been scanned for this scope.
 *
 * Compared by canonical path, since the same catalog reached by two names is
 * one catalog. A root that cannot be resolved is left to the scan, which is
 * where the reason gets reported.
 *
 * Scope is part of the key: a directory configured as both a global and a
 * project root yields two skills with two identities, which is what ADR-0007
 * says they are.
 */
async function alreadyScanned(
  root: string,
  scope: SkillScope,
  scanned: Set<string>,
): Promise<boolean> {
  let canonical: string

  try {
    canonical = await canonicalizeRoot(root)
  } catch {
    return false
  }

  const key = `${scope}:${canonical}`

  if (scanned.has(key)) {
    return true
  }

  scanned.add(key)

  return false
}

async function scanRoot(
  root: string,
  scope: SkillScope,
  options: RegistryOptions,
): Promise<Awaited<ReturnType<typeof scanSkillRoot>> | RegistryDiagnostic> {
  try {
    return await scanSkillRoot(root, scope, policyForScope(scope, options.policy), options.limits)
  } catch (error) {
    return { path: root, reason: describeError(error) }
  }
}

/**
 * Widens the path policy for a global root, and only for a global root.
 *
 * `followSymlinks` exists for the operator who keeps one catalog and links it
 * into place; refusing a link whose target sits elsewhere would deny that
 * layout entirely. A project root is a different kind of directory: it arrives
 * with a checkout, so its links stay contained whatever the option says
 * (ADR-0007, ADR-0013).
 */
function policyForScope(scope: SkillScope, policy: PathPolicy): PathPolicy {
  return scope === 'global' ? { ...policy, linksMayLeaveRoot: policy.followSymlinks } : policy
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
