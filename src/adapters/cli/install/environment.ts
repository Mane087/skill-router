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
