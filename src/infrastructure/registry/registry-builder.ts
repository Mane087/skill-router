import { createInMemorySkillRepository } from './in-memory-skill-repository.js'
import { scanSkillRoot } from './skill-scanner.js'
import { formatSkillId } from '../../domain/skill/skill-id.js'
import type { ScanLimits, ScannedSkill, SkillScanDiagnostic } from './skill-scanner.js'
import type { PathPolicy } from '../filesystem/safe-path.js'
import type { SkillRepository } from '../../application/ports/skill-repository.js'
import type { SkillScope } from '../../domain/skill/skill-id.js'

export interface SkillRoots {
  readonly global: readonly string[]
  readonly project: readonly string[]
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
 * directory should still get their project skills.
 *
 * Scope is part of a skill's identity, so `global:angular` and
 * `project:angular` coexist. Within one scope the first root wins, and the
 * shadowed copy is reported rather than dropped silently.
 */
export async function buildSkillRegistry(options: RegistryOptions): Promise<SkillRegistry> {
  const entries: ScannedSkill[] = []
  const diagnostics: RegistryDiagnostic[] = []
  const seen = new Set<string>()

  for (const { scope, root } of enumerateRoots(options.roots)) {
    const result = await scanRoot(root, scope, options)

    if ('reason' in result) {
      diagnostics.push(result)
      continue
    }

    diagnostics.push(...result.diagnostics)

    for (const entry of result.skills) {
      const key = formatSkillId(entry.skill.id)

      if (seen.has(key)) {
        diagnostics.push({
          path: entry.directory,
          reason: `Duplicate skill ${key} ignored: an earlier root already provides it.`,
        })
        continue
      }

      seen.add(key)
      entries.push(entry)
    }
  }

  return {
    repository: createInMemorySkillRepository(entries),
    entries,
    diagnostics,
  }
}

function* enumerateRoots(roots: SkillRoots): Generator<{ scope: SkillScope; root: string }> {
  for (const root of roots.global) {
    yield { scope: 'global', root }
  }

  for (const root of roots.project) {
    yield { scope: 'project', root }
  }
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
