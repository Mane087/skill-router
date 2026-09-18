import { spawn } from 'node:child_process'

export interface CommandResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * Runs another program and reports how it went.
 *
 * A port, not a helper: the install commands for Claude Code and Codex are
 * defined by what they run, and a test that has to spawn a real CLI cannot
 * assert that.
 */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>

/** The exit code a shell reports for a command that does not exist. */
export const COMMAND_NOT_FOUND = 127

/**
 * Runs a real process.
 *
 * A missing executable is reported as exit code 127 rather than a rejection, so
 * callers handle "not installed" the same way they handle "refused", which is
 * the case they already have to cover.
 *
 * Arguments are passed as a list and never through a shell, so a skill name is
 * an argument and never a command.
 */
export function createProcessRunner(): CommandRunner {
  return (command, args) =>
    new Promise((resolve) => {
      const child = spawn(command, [...args], { shell: false })
      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      child.on('error', (error: Error) => {
        resolve({ code: COMMAND_NOT_FOUND, stdout, stderr: `${stderr}${error.message}` })
      })

      child.on('close', (code) => {
        resolve({ code: code ?? 1, stdout, stderr })
      })
    })
}
