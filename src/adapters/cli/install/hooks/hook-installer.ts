import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { HOOK_EVENT, HOOK_FILENAME } from './hook-target.js'
import { CliFailureError, CliUsageError } from '../../errors.js'
import type { HookTarget } from './hook-target.js'
import type { InstallOutcome } from '../install-request.js'

/** A hook the client cannot execute is a hook that silently never runs. */
const SCRIPT_MODE = 0o755

/** What was found where something has to be written. */
type State = 'absent' | 'same' | 'different'

export interface HookOptions {
  readonly force: boolean
  readonly dryRun: boolean
}

/**
 * Installs the nudge hook for one client.
 *
 * Two files, written in that order: the script, and the entry in the client's
 * configuration that points at it. Both are checked before either is touched,
 * so a configuration this cannot parse leaves the machine exactly as it was
 * rather than with a script nothing runs.
 *
 * The configuration is merged, never rewritten: it belongs to its author, and
 * everything from an unrelated hook to a theme survives. Anything under this
 * name that does not match what would be written was edited by somebody, so it
 * is protected until `--force` says otherwise.
 *
 * @throws {CliUsageError} when something differs and replacing it was not asked for.
 * @throws {CliFailureError} when the configuration file exists but cannot be used.
 */
export async function installHook(
  target: HookTarget,
  options: HookOptions,
): Promise<InstallOutcome> {
  const scriptState = await readState(target.scriptPath, target.script)
  const config = await readConfig(target.configPath)
  const entries = readEntries(config, target.configPath)
  const index = entries.findIndex(isThisHook)
  const configState = describeEntry(entries[index], target)

  if (scriptState === 'same' && configState === 'same') {
    return {
      action: 'unchanged',
      summary: `${target.label} already runs ${target.scriptPath}.`,
    }
  }

  if (!options.force && (scriptState === 'different' || configState === 'different')) {
    throw new CliUsageError(
      `${describeConflict(scriptState, configState, target)} Re-run with --force to replace it.`,
    )
  }

  if (options.dryRun) {
    return {
      action: 'planned',
      summary: `Would write ${target.scriptPath} and add ${HOOK_EVENT} to ${target.configPath}.`,
    }
  }

  await writeScript(target)
  await writeConfig(target, config, replaceEntry(entries, index, target))

  return {
    action: scriptState === 'absent' && configState === 'absent' ? 'added' : 'updated',
    summary: `${target.label}: ${target.scriptPath}, ${target.configPath} ${HOOK_EVENT}`,
  }
}

async function writeScript(target: HookTarget): Promise<void> {
  await mkdir(dirname(target.scriptPath), { recursive: true })
  await writeFile(target.scriptPath, target.script, 'utf8')
  // Set apart from the write, which only applies a mode to a file it creates:
  // a script that was already there keeps whatever mode it had otherwise.
  await chmod(target.scriptPath, SCRIPT_MODE)
}

async function writeConfig(
  target: HookTarget,
  config: Record<string, unknown>,
  entries: readonly unknown[],
): Promise<void> {
  const hooks = isPlainObject(config.hooks) ? config.hooks : {}
  const updated = { ...config, hooks: { ...hooks, [HOOK_EVENT]: entries } }

  await mkdir(dirname(target.configPath), { recursive: true })
  await writeFile(target.configPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
}

/** Replaces the entry where it already sits, so a hand-ordered list keeps its order. */
function replaceEntry(
  entries: readonly unknown[],
  index: number,
  target: HookTarget,
): readonly unknown[] {
  if (index === -1) {
    return [...entries, target.entry]
  }

  return entries.map((entry, position) => (position === index ? target.entry : entry))
}

/** An absent file is not an error: it is the first install on this machine. */
async function readState(path: string, expected: string): Promise<State> {
  try {
    return (await readFile(path, 'utf8')) === expected ? 'same' : 'different'
  } catch {
    return 'absent'
  }
}

function describeEntry(existing: unknown, target: HookTarget): State {
  if (existing === undefined) {
    return 'absent'
  }

  // Compared as serialized shapes: the entry is a literal this command writes
  // itself, so its key order is fixed, and anything a person edited differs
  // here and is therefore protected instead of silently replaced.
  return JSON.stringify(existing) === JSON.stringify(target.entry) ? 'same' : 'different'
}

/**
 * Recognizes the entry this command owns.
 *
 * By the script it runs, because these entries have no name: two installs must
 * not leave two copies, and an entry pointing at somebody else's script is not
 * this one however similar it looks.
 */
function isThisHook(entry: unknown): boolean {
  if (!isPlainObject(entry) || !Array.isArray(entry.hooks)) {
    return false
  }

  return entry.hooks.some(
    (hook: unknown) =>
      isPlainObject(hook) &&
      typeof hook.command === 'string' &&
      hook.command.includes(HOOK_FILENAME),
  )
}

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

function readEntries(config: Record<string, unknown>, path: string): readonly unknown[] {
  const hooks = config.hooks

  if (hooks === undefined) {
    return []
  }

  if (!isPlainObject(hooks)) {
    throw new CliFailureError(
      `${path} has a "hooks" field that is not an object, so it was left alone.`,
    )
  }

  const entries = hooks[HOOK_EVENT]

  if (entries === undefined) {
    return []
  }

  if (!Array.isArray(entries)) {
    throw new CliFailureError(
      `${path} has a "hooks.${HOOK_EVENT}" field that is not a list, so it was left alone.`,
    )
  }

  return entries as readonly unknown[]
}

function describeConflict(script: State, entry: State, target: HookTarget): string {
  if (script === 'different' && entry === 'different') {
    return `${target.scriptPath} and the ${HOOK_EVENT} entry in ${target.configPath} both differ from what this would write.`
  }

  return script === 'different'
    ? `${target.scriptPath} differs from the script this would write.`
    : `${target.configPath} already has a ${HOOK_EVENT} entry for ${HOOK_FILENAME} that differs from what this would write.`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
