/**
 * A command line that cannot be carried out as written.
 *
 * Separate from the domain errors: those describe skills and paths, this one
 * describes how the binary was invoked. It carries the exit code so the entry
 * point does not have to map error shapes back to process semantics.
 */
export class CliUsageError extends Error {
  readonly exitCode = 2

  constructor(message: string) {
    super(message)
    this.name = 'CliUsageError'
  }
}

/** A command that was understood but could not be completed. */
export class CliFailureError extends Error {
  readonly exitCode = 1

  constructor(message: string) {
    super(message)
    this.name = 'CliFailureError'
  }
}
