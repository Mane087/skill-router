import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { SKILL_FILES, SKILL_NAME } from './skill-files.generated.js'
import { CliUsageError } from '../../errors.js'
import type { SkillTarget } from './skill-target.js'
import type { InstallOutcome } from '../install-request.js'

/** What was found where something has to be written. */
type State = 'absent' | 'same' | 'different'

/** One file of the skill, resolved against the machine it is being written to. */
interface PlannedFile {
  readonly path: string
  readonly contents: string
  readonly state: State
}

export interface SkillOptions {
  readonly force: boolean
  readonly dryRun: boolean
}

/**
 * Writes the routing-metadata skill into one client's skills directory.
 *
 * The skill complements the server rather than duplicating it: the server
 * answers which skill fits a task, and this one teaches the agent to write the
 * frontmatter the server ranks on. Registering the server without it leaves an
 * agent that can search a catalogue it has no way to improve.
 *
 * Every file is inspected before any is written, so a directory somebody edited
 * is refused whole instead of half replaced. Files that are already there and
 * are not the skill's are left alone: the directory belongs to its owner, and a
 * note somebody kept beside the skill is not this command's to delete.
 *
 * @throws {CliUsageError} when a file differs and replacing it was not asked for.
 */
export async function installSkill(
  target: SkillTarget,
  options: SkillOptions,
): Promise<InstallOutcome> {
  const planned = await plan(target)

  if (planned.every((file) => file.state === 'same')) {
    return {
      action: 'unchanged',
      summary: `${target.label} already has ${SKILL_NAME} in ${target.directory}.`,
    }
  }

  const edited = planned.filter((file) => file.state === 'different')

  if (!options.force && edited.length > 0) {
    throw new CliUsageError(
      `${describeConflict(edited)} Re-run with --force to replace ${edited.length === 1 ? 'it' : 'them'}.`,
    )
  }

  if (options.dryRun) {
    return {
      action: 'planned',
      summary: `Would write ${countOf(planned.length)} into ${target.directory}.`,
    }
  }

  await write(planned)

  return {
    action: planned.every((file) => file.state === 'absent') ? 'added' : 'updated',
    summary: `${target.label}: ${target.directory}, ${countOf(planned.length)}`,
  }
}

async function plan(target: SkillTarget): Promise<readonly PlannedFile[]> {
  return await Promise.all(
    Object.entries(SKILL_FILES).map(async ([relative, contents]) => {
      // Split rather than joined as one string: the generated keys are always
      // written with forward slashes, and Windows needs them back as segments.
      const path = join(target.directory, ...relative.split('/'))

      return { path, contents, state: await readState(path, contents) }
    }),
  )
}

/**
 * Written one file at a time rather than in parallel.
 *
 * Two files of the same skill share a parent directory, and `mkdir` racing
 * itself is the kind of failure that only appears on somebody else's machine.
 */
async function write(planned: readonly PlannedFile[]): Promise<void> {
  for (const file of planned) {
    await mkdir(dirname(file.path), { recursive: true })
    await writeFile(file.path, file.contents, 'utf8')
  }
}

/** An absent file is not an error: it is the first install on this machine. */
async function readState(path: string, expected: string): Promise<State> {
  try {
    return (await readFile(path, 'utf8')) === expected ? 'same' : 'different'
  } catch {
    return 'absent'
  }
}

/** Names every file that differs, because the operator has to go and read them. */
function describeConflict(edited: readonly PlannedFile[]): string {
  const paths = edited.map((file) => file.path).join(', ')

  return edited.length === 1
    ? `${paths} differs from the file this would write.`
    : `${paths} differ from the files this would write.`
}

function countOf(total: number): string {
  return `${String(total)} ${total === 1 ? 'file' : 'files'}`
}
