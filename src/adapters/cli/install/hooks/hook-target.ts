/** What the hook file is called inside a client's `hooks` directory. */
export const HOOK_FILENAME = 'skill-router-nudge.sh'

/** The event both clients fire before they run a tool. */
export const HOOK_EVENT = 'PreToolUse'

/**
 * Seconds a client waits for the script.
 *
 * The script reads one JSON object, matches a few patterns and prints one more.
 * Anything slower than this is a machine in trouble, and a hook that hangs
 * would stall every tool call the agent makes.
 */
export const HOOK_TIMEOUT_SECONDS = 5

/** What the client shows while the hook runs. */
export const HOOK_STATUS_MESSAGE = 'Consultando política de skills'

/** One command inside a hook entry. */
export interface HookCommand {
  readonly type: 'command'
  readonly command: string
  readonly timeout: number
  readonly statusMessage: string
}

/** One entry in a client's `PreToolUse` list. */
export interface HookEntry {
  readonly matcher: string
  readonly hooks: readonly HookCommand[]
}

/** The clients that have a `PreToolUse` hook this can be installed into. */
export type HookClient = 'claude' | 'codex'

/**
 * Everything that differs between the two clients, resolved for this machine.
 *
 * The installer takes one of these and knows nothing else about the client: both
 * keep a JSON file with a `hooks.PreToolUse` list and both run a shell script,
 * so the only real differences are the paths, the matcher and the script itself.
 */
export interface HookTarget {
  /** How the client is named in a message to a person. */
  readonly label: string
  /** The script, written and made executable. */
  readonly scriptPath: string
  /** The JSON file whose `PreToolUse` list carries the entry. */
  readonly configPath: string
  /** The script's contents, carried inside this binary. */
  readonly script: string
  readonly entry: HookEntry
}
