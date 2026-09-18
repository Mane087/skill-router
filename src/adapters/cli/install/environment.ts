import { join } from 'node:path'

/**
 * Everything the install commands read from the machine they run on.
 *
 * Passed in rather than read from `process` and `os` at the point of use, so
 * detecting a client and writing a configuration file can both be tested
 * against a temporary directory instead of the developer's real home.
 */
export interface InstallEnvironment {
  readonly cwd: string
  readonly home: string
  /** `XDG_CONFIG_HOME`, when the platform sets it. */
  readonly configHome: string | undefined
  /** `CODEX_HOME`, which moves everything Codex reads away from `~/.codex`. */
  readonly codexHome: string | undefined
  readonly path: string | undefined
  /** `PATHEXT`, which is what makes an file executable on Windows. */
  readonly pathExtensions: string | undefined
}

/**
 * Where a client that follows the XDG convention keeps its configuration.
 *
 * Shared because more than one thing is written under it: opencode's
 * `opencode.json` and its skills directory both live here, and resolving the
 * fallback twice would let the two drift apart on a machine that sets
 * `XDG_CONFIG_HOME`.
 */
export function userConfigDirectory(environment: InstallEnvironment): string {
  return environment.configHome ?? join(environment.home, '.config')
}
