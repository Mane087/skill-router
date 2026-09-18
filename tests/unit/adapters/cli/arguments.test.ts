import { parseArguments } from '../../../../src/adapters/cli/arguments.js'
import { CliUsageError } from '../../../../src/adapters/cli/errors.js'

describe('parseArguments', () => {
  it('serves when no argument is given, which is how an MCP client launches it', () => {
    expect(parseArguments([])).toEqual({ kind: 'serve' })
  })

  it.each([['serve'], ['--help'], ['-h'], ['help'], ['--version'], ['-v']])(
    'recognizes %s',
    (argument) => {
      expect(parseArguments([argument]).kind).toMatch(/^(serve|help|version)$/)
    },
  )

  it('applies the documented defaults to an install with no options', () => {
    expect(parseArguments(['install', 'claude'])).toEqual({
      kind: 'install',
      client: 'claude',
      name: 'skill-router',
      scope: 'user',
      force: false,
      dryRun: false,
      hook: false,
    })
  })

  it.each([['claude'], ['codex'], ['opencode']])('accepts %s as a client', (client) => {
    expect(parseArguments(['install', client])).toMatchObject({ client })
  })

  it('reads every install option', () => {
    expect(
      parseArguments([
        'install',
        'opencode',
        '--name',
        'skills',
        '--scope',
        'project',
        '--force',
        '--dry-run',
      ]),
    ).toEqual({
      kind: 'install',
      client: 'opencode',
      name: 'skills',
      scope: 'project',
      force: true,
      dryRun: true,
      hook: false,
    })
  })

  it('reads --hook, which asks for the nudge hook as well as the registration', () => {
    expect(parseArguments(['install', 'claude', '--hook'])).toMatchObject({ hook: true })
  })

  it('accepts an option written as --name=value', () => {
    expect(parseArguments(['install', 'claude', '--name=skills'])).toMatchObject({ name: 'skills' })
  })

  it.each([
    ['no client', ['install']],
    ['an unknown client', ['install', 'vscode']],
    ['an unknown scope', ['install', 'claude', '--scope', 'global']],
    ['an option with no value', ['install', 'claude', '--name']],
    ['an unknown option', ['install', 'claude', '--transport', 'http']],
    ['an empty name', ['install', 'claude', '--name', '  ']],
    ['a second client', ['install', 'claude', 'codex']],
    ['an unknown command', ['bogus']],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseArguments(argv)).toThrow(CliUsageError)
  })

  it('names the offending value, so the message is actionable', () => {
    expect(() => parseArguments(['install', 'vscode'])).toThrow(/vscode/)
  })
})
