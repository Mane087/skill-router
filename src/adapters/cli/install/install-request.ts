import type { InstallScope } from '../arguments.js'

export interface InstallRequest {
  /** What the server is registered as inside the client's configuration. */
  readonly name: string
  readonly scope: InstallScope
  /** The command that launches this server, already resolved to a real path. */
  readonly command: readonly string[]
  readonly force: boolean
  readonly dryRun: boolean
}

export interface InstallOutcome {
  /** `skipped` means the client is not on this machine, which is not a failure. */
  readonly action: 'added' | 'updated' | 'unchanged' | 'planned' | 'skipped'
  /** One line for the operator, naming what changed and where. */
  readonly summary: string
}
