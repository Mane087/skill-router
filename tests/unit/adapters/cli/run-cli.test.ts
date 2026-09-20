import {
  isCompiledEntryPath,
  resolveServerCommand,
} from '../../../../src/adapters/cli/install/server-command.js'
import { runCli } from '../../../../src/adapters/cli/run-cli.js'
import { SERVER_VERSION } from '../../../../src/adapters/mcp/server-metadata.js'
import type { CliDependencies } from '../../../../src/adapters/cli/run-cli.js'

function dependencies(overrides: Partial<CliDependencies> = {}): {
  deps: CliDependencies
  out: string[]
  err: string[]
  served: { count: number }
} {
  const out: string[] = []
  const err: string[] = []
  const served = { count: 0 }

  const deps: CliDependencies = {
    serve: () => {
      served.count += 1

      return Promise.resolve()
    },
    run: () => Promise.resolve({ code: 0, stdout: '', stderr: '' }),
    detect: () => Promise.resolve({ installed: true, evidence: 'found it' }),
    environment: {
      cwd: '/workspace',
      home: '/home/someone',
      configHome: undefined,
      codexHome: undefined,
      path: undefined,
      pathExtensions: undefined,
    },
    serverCommand: ['/usr/bin/node', '/opt/skill-router/dist/bootstrap/main.js'],
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...overrides,
  }

  return { deps, out, err, served }
}

describe('runCli', () => {
  it('serves when given no argument', async () => {
    const { deps, served, out } = dependencies()

    expect(await runCli([], deps)).toBe(0)
    expect(served.count).toBe(1)
    // stdout carries the JSON-RPC stream, so serving must print nothing to it.
    expect(out).toEqual([])
  })

  it('prints the usage on --help', async () => {
    const { deps, out } = dependencies()

    expect(await runCli(['--help'], deps)).toBe(0)
    expect(out.join('\n')).toContain('install <client>')
  })

  it('names all three clients in the usage, since that is what it is for', async () => {
    const { deps, out } = dependencies()

    await runCli(['--help'], deps)

    expect(out.join('\n')).toEqual(expect.stringMatching(/claude[\s\S]*codex[\s\S]*opencode/))
  })

  it('prints the server version on --version', async () => {
    const { deps, out } = dependencies()

    expect(await runCli(['--version'], deps)).toBe(0)
    expect(out.join('\n')).toContain(SERVER_VERSION)
  })

  it('reports a usage error on stderr with exit code 2', async () => {
    const { deps, err, out } = dependencies()

    expect(await runCli(['install', 'vscode'], deps)).toBe(2)
    expect(err.join('\n')).toContain('vscode')
    expect(out).toEqual([])
  })

  it('points a usage error at the help, rather than leaving the caller guessing', async () => {
    const { deps, err } = dependencies()

    await runCli(['install', 'vscode'], deps)

    expect(err.join('\n')).toContain('--help')
  })

  it('reports a failed registration on stderr with exit code 1', async () => {
    const { deps, err } = dependencies({
      run: () => Promise.resolve({ code: 1, stdout: '', stderr: 'refused' }),
    })

    expect(await runCli(['install', 'claude'], deps)).toBe(1)
    expect(err.join('\n')).toContain('refused')
  })

  it('installs into Claude Code and says what it did', async () => {
    const calls: string[][] = []
    const { deps, out } = dependencies({
      run: (command, args) => {
        calls.push([command, ...args])

        return Promise.resolve({ code: 0, stdout: '', stderr: '' })
      },
    })

    expect(await runCli(['install', 'claude'], deps)).toBe(0)
    expect(calls[0]).toEqual([
      'claude',
      'mcp',
      'add',
      'skill-router',
      '--scope',
      'user',
      '--',
      '/usr/bin/node',
      '/opt/skill-router/dist/bootstrap/main.js',
    ])
    expect(out.join('\n')).toContain('Claude Code')
  })

  it('exits 0 when the client is not on this machine, and says so on stdout', async () => {
    const { deps, out, err } = dependencies({
      detect: () =>
        Promise.resolve({ installed: false, evidence: 'Looked for /home/someone/.codex.' }),
    })

    expect(await runCli(['install', 'codex'], deps)).toBe(0)
    expect(out.join('\n')).toContain('Skipped: codex is not installed')
    expect(err).toEqual([])
  })

  it('still fails a command that is wrong, even where the client is missing', async () => {
    const { deps, err } = dependencies({
      detect: () => Promise.resolve({ installed: false, evidence: 'nothing here' }),
    })

    expect(await runCli(['install', 'codex', '--scope', 'project'], deps)).toBe(2)
    expect(err.join('\n')).toContain('config.toml')
  })

  it('refuses --hook for opencode, which has plugins rather than PreToolUse hooks', async () => {
    const { deps, err } = dependencies()

    expect(await runCli(['install', 'opencode', '--hook'], deps)).toBe(2)
    expect(err.join('\n')).toContain('opencode')
  })

  it('refuses --hook with a project scope, because the hook it writes is user-level', async () => {
    const { deps, err } = dependencies()

    expect(await runCli(['install', 'claude', '--hook', '--scope', 'project'], deps)).toBe(2)
    expect(err.join('\n')).toContain('--scope user')
  })

  it('fails when jq is missing, since the hook script reads the tool call with it', async () => {
    const { deps, err } = dependencies()

    expect(await runCli(['install', 'claude', '--hook'], deps)).toBe(1)
    expect(err.join('\n')).toContain('jq')
  })

  it('registers nothing when jq is missing, rather than leaving half an install', async () => {
    const calls: string[][] = []
    const { deps } = dependencies({
      run: (command, args) => {
        calls.push([command, ...args])

        return Promise.resolve({ code: 0, stdout: '', stderr: '' })
      },
    })

    await runCli(['install', 'claude', '--hook'], deps)

    expect(calls).toEqual([])
  })

  it('never serves when it was asked to install', async () => {
    const { deps, served } = dependencies()

    await runCli(['install', 'claude'], deps)

    expect(served.count).toBe(0)
  })
})

describe('resolveServerCommand', () => {
  it('registers an absolute path, because the npm name belongs to somebody else', () => {
    expect(resolveServerCommand('file:///opt/app/dist/bootstrap/main.js')[1]).toBe(
      '/opt/app/dist/bootstrap/main.js',
    )
  })

  it('pins the interpreter that is running, not whatever "node" resolves to later', () => {
    expect(resolveServerCommand('file:///opt/app/dist/bootstrap/main.js')[0]).toBe(process.execPath)
  })

  // A compiled binary is its own interpreter, and its entry point resolves
  // inside Bun's virtual filesystem. Registering that path as a second element
  // hands the binary its own virtual path as a subcommand, which it rejects,
  // so the client only ever sees the connection close.
  it.each([
    ['linux and macOS', 'file:///$bunfs/root/skill-router-mcp-linux-x64'],
    ['windows', 'file:///B:/~BUN/root/skill-router-mcp-windows-x64.exe'],
    // The release smoke test found the Windows binary registering its virtual
    // path while this returned a single element for the URL above. The URL and
    // the path it converts to are not the same text, and only the path is what
    // the binary is handed, so the detection reads the path.
    ['windows, with the tilde escaped', 'file:///B:/%7EBUN/root/skill-router-mcp-windows-x64.exe'],
  ])('registers the executable alone for a compiled binary on %s', (_platform, entryUrl) => {
    expect(resolveServerCommand(entryUrl)).toEqual([process.execPath])
  })
})

describe('isCompiledEntryPath', () => {
  // `fileURLToPath` only spells a Windows path with backslashes when it runs on
  // Windows, so this is the only place the real one can be asserted.
  it.each([
    ['/$bunfs/root/skill-router-mcp-linux-x64'],
    ['B:\\~BUN\\root\\skill-router-mcp-windows-x64.exe'],
  ])("recognises %s as Bun's own entry point", (entryPath) => {
    expect(isCompiledEntryPath(entryPath)).toBe(true)
  })

  // `~bun` is a directory anybody may create. Only Bun's drive makes it Bun's.
  it.each([
    ['/opt/app/dist/bootstrap/main.js'],
    ['/home/me/~bun/app/dist/bootstrap/main.js'],
    ['C:\\Users\\me\\~bun\\app\\main.js'],
  ])('leaves %s alone', (entryPath) => {
    expect(isCompiledEntryPath(entryPath)).toBe(false)
  })
})
