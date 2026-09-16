import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ReferenceNotFoundError, SkillNotFoundError, UnsafePathError } from '../../domain/errors.js'
import { formatSkillId, isValidSkillName } from '../../domain/skill/skill-id.js'
import { parseFrontmatter } from '../manifest/frontmatter-parser.js'
import { resolveWithinRoot } from '../filesystem/safe-path.js'
import type { PathPolicy } from '../filesystem/safe-path.js'
import type { SkillContentReader } from '../../application/ports/skill-content-reader.js'
import type { SkillId } from '../../domain/skill/skill-id.js'
import type { ScannedSkill } from './skill-scanner.js'

const REFERENCES_DIRECTORY = 'references'
const REFERENCE_EXTENSION = '.md'

export interface ContentLimits {
  readonly maxReferenceBytes: number
}

/**
 * Reads skill bodies and references from disk.
 *
 * A reference name arrives from the calling agent, so it is treated as hostile
 * input. Two independent defences apply: the name must be a plain kebab-case
 * word, which leaves no way to express a separator or a traversal segment, and
 * the resolved path is then contained within the skill's own directory.
 *
 * Locations come from the registry, never from a manifest, so a skill cannot
 * point at content outside itself.
 */
export function createFilesystemSkillContentReader(
  entries: readonly ScannedSkill[],
  policy: PathPolicy,
  limits: ContentLimits,
): SkillContentReader {
  const directories = new Map(
    entries.map((entry) => [formatSkillId(entry.skill.id), entry.directory]),
  )

  function locate(id: SkillId): string {
    const directory = directories.get(formatSkillId(id))

    if (directory === undefined) {
      throw new SkillNotFoundError(`No skill registered as ${formatSkillId(id)}.`)
    }

    return directory
  }

  return {
    async readBody(id: SkillId): Promise<string> {
      const file = await resolveWithinRoot(locate(id), 'SKILL.md', policy)

      return parseFrontmatter(await readFile(file, 'utf8')).body.trim()
    },

    async listReferences(id: SkillId): Promise<readonly string[]> {
      const directory = locate(id)
      let files: string[]

      try {
        const entriesInDirectory = await readdir(join(directory, REFERENCES_DIRECTORY), {
          withFileTypes: true,
        })

        // Only regular files: a symlink is not followed, so listing one would
        // advertise a reference that reading it would refuse.
        files = entriesInDirectory
          .filter((entry) => entry.isFile() && entry.name.endsWith(REFERENCE_EXTENSION))
          .map((entry) => entry.name.slice(0, -REFERENCE_EXTENSION.length))
      } catch {
        // No references directory simply means the skill offers none.
        return []
      }

      return files.filter((name) => isValidSkillName(name)).sort()
    },

    async readReference(id: SkillId, reference: string): Promise<string> {
      const directory = locate(id)

      // Rejected before any path is built, so a traversal never reaches the
      // filesystem layer at all.
      if (!isValidSkillName(reference)) {
        throw new UnsafePathError(
          `Reference name must be lowercase kebab-case without an extension: received ${JSON.stringify(reference)}.`,
        )
      }

      const relative = join(REFERENCES_DIRECTORY, `${reference}${REFERENCE_EXTENSION}`)
      let file: string

      try {
        file = await resolveWithinRoot(directory, relative, policy)
      } catch (error) {
        // A missing file and an unsafe path both surface here. Only the first
        // is the caller asking for something that does not exist.
        if (error instanceof UnsafePathError && (await isMissing(join(directory, relative)))) {
          throw new ReferenceNotFoundError(
            `Skill ${formatSkillId(id)} has no reference named "${reference}".`,
          )
        }

        throw error
      }

      await assertWithinSizeLimit(file, reference, limits.maxReferenceBytes)

      return readFile(file, 'utf8')
    },
  }
}

async function isMissing(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return false
  } catch {
    return true
  }
}

async function assertWithinSizeLimit(
  file: string,
  reference: string,
  maxBytes: number,
): Promise<void> {
  const { size } = await lstat(file)

  if (size > maxBytes) {
    throw new UnsafePathError(
      `Reference "${reference}" exceeds ${String(maxBytes / 1024)} KB: it is ${String(Math.round(size / 1024))} KB.`,
    )
  }
}
