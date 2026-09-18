import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { detectClient } from '../../src/adapters/cli/install/client-presence.js'
import type { InstallEnvironment } from '../../src/adapters/cli/install/environment.js'

let workspace: string
let counter = 0

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-presence-'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

async function makeEnvironment(
  directories: readonly string[] = [],
  executables: readonly string[] = [],
): Promise<InstallEnvironment> {
  counter += 1
  const root = join(workspace, `case-${String(counter)}`)
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  await mkdir(home, { recursive: true })
  await mkdir(bin, { recursive: true })

  for (const directory of directories) {
    await mkdir(join(home, directory), { recursive: true })
  }

  for (const executable of executables) {
    const path = join(bin, executable)
    await writeFile(path, '#!/bin/sh\n')
    await chmod(path, 0o755)
  }

  return {
    cwd: root,
    home,
    configHome: undefined,
    codexHome: undefined,
    path: bin,
    pathExtensions: undefined,
  }
}

describe('detectClient by configuration directory', () => {
  it.each([
    ['claude', '.claude'],
    ['codex', '.codex'],
    ['opencode', '.opencode'],
  ] as const)('finds %s at ~/%s', async (client, directory) => {
    const environment = await makeEnvironment([directory])

    const presence = await detectClient(client, environment)

    expect(presence.installed).toBe(true)
    expect(presence.evidence).toContain(directory)
  })

  it('also finds opencode by the directory its configuration actually lives in', async () => {
    const environment = await makeEnvironment([join('.config', 'opencode')])

    expect((await detectClient('opencode', environment)).installed).toBe(true)
  })

  it('honours XDG_CONFIG_HOME when looking for the opencode configuration', async () => {
    const base = await makeEnvironment()
    const configHome = join(base.cwd, 'xdg')
    await mkdir(join(configHome, 'opencode'), { recursive: true })

    expect((await detectClient('opencode', { ...base, configHome })).installed).toBe(true)
  })

  it('does not take one client as evidence of another', async () => {
    const environment = await makeEnvironment(['.claude'])

    expect((await detectClient('codex', environment)).installed).toBe(false)
  })

  it('ignores a file sitting where the directory should be', async () => {
    const base = await makeEnvironment()
    await writeFile(join(base.home, '.claude'), 'not a directory')

    expect((await detectClient('claude', base)).installed).toBe(false)
  })
})

describe('detectClient by executable', () => {
  it('finds a client that is installed but has never been run', async () => {
    const environment = await makeEnvironment([], ['claude'])

    const presence = await detectClient('claude', environment)

    expect(presence.installed).toBe(true)
    expect(presence.evidence).toContain('PATH')
  })

  it('searches every entry of PATH', async () => {
    const first = await makeEnvironment()
    const second = await makeEnvironment([], ['codex'])

    const presence = await detectClient('codex', {
      ...first,
      path: [first.path, second.path].join(delimiter),
    })

    expect(presence.installed).toBe(true)
  })

  it('ignores a file on PATH that is not executable', async () => {
    const base = await makeEnvironment()
    const path = join(base.path ?? '', 'claude')
    await writeFile(path, '#!/bin/sh\n')
    await chmod(path, 0o644)

    expect((await detectClient('claude', base)).installed).toBe(false)
  })

  it('copes with PATH being unset', async () => {
    const base = await makeEnvironment()

    expect((await detectClient('claude', { ...base, path: undefined })).installed).toBe(false)
  })
})

describe('detectClient when the client is absent', () => {
  it('names every place it looked, so the report is actionable', async () => {
    const environment = await makeEnvironment()

    const presence = await detectClient('claude', environment)

    expect(presence.installed).toBe(false)
    expect(presence.evidence).toContain(join(environment.home, '.claude'))
    expect(presence.evidence).toContain('claude')
  })
})
