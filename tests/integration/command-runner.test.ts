import { COMMAND_NOT_FOUND, createProcessRunner } from '../../src/adapters/cli/command-runner.js'

const run = createProcessRunner()

describe('createProcessRunner', () => {
  it('returns what the program printed and the code it exited with', async () => {
    const result = await run(process.execPath, ['-e', 'process.stdout.write("hello")'])

    expect(result).toEqual({ code: 0, stdout: 'hello', stderr: '' })
  })

  it('keeps stderr separate, which is where a CLI explains a refusal', async () => {
    const result = await run(process.execPath, [
      '-e',
      'process.stderr.write("refused"); process.exit(3)',
    ])

    expect(result).toMatchObject({ code: 3, stderr: 'refused' })
  })

  it('reports a missing executable as 127 rather than rejecting', async () => {
    const result = await run('skill-router-no-such-executable', ['mcp', 'add'])

    expect(result.code).toBe(COMMAND_NOT_FOUND)
    expect(result.stderr).toContain('ENOENT')
  })

  it('passes arguments as arguments, never through a shell', async () => {
    // Interpreted by a shell this would create a file; as an argument it is
    // just a string the program prints back.
    const injection = '; touch /tmp/skill-router-should-not-exist'
    const result = await run(process.execPath, [
      '-e',
      'process.stdout.write(process.argv[1])',
      injection,
    ])

    expect(result.stdout).toBe(injection)
  })
})
