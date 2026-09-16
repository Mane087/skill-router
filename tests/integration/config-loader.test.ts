import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CONFIG_FILENAME, loadConfig } from '../../src/infrastructure/config/config-loader.js'
import { DEFAULT_CONFIG } from '../../src/infrastructure/config/config-schema.js'
import { InvalidConfigError } from '../../src/domain/errors.js'

let workspace: string

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-config-'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe('loadConfig without a file', () => {
  it('falls back to defaults, since running unconfigured is expected', async () => {
    await expect(loadConfig(undefined, workspace)).resolves.toEqual(DEFAULT_CONFIG)
  })

  it('picks up the conventional file name when it exists', async () => {
    const directory = join(workspace, 'conventional')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, CONFIG_FILENAME), 'search:\n  defaultLimit: 2\n')

    await expect(loadConfig(undefined, directory)).resolves.toMatchObject({
      search: { defaultLimit: 2 },
    })
  })
})

describe('loadConfig with an explicit file', () => {
  it('reads the settings the file declares', async () => {
    const file = join(workspace, 'custom.yaml')
    await writeFile(file, 'version: 1\nsecurity:\n  followSymlinks: true\n')

    await expect(loadConfig(file, workspace)).resolves.toMatchObject({
      security: { followSymlinks: true },
    })
  })

  it('resolves a relative path against the working directory', async () => {
    await writeFile(join(workspace, 'relative.yaml'), 'search:\n  defaultLimit: 3\n')

    await expect(loadConfig('relative.yaml', workspace)).resolves.toMatchObject({
      search: { defaultLimit: 3 },
    })
  })

  it('fails when the named file does not exist, rather than using defaults', async () => {
    await expect(loadConfig(join(workspace, 'absent.yaml'), workspace)).rejects.toThrow(
      InvalidConfigError,
    )
  })

  it('fails on malformed YAML', async () => {
    const file = join(workspace, 'broken.yaml')
    await writeFile(file, 'roots: [unclosed\n')

    await expect(loadConfig(file, workspace)).rejects.toThrow(InvalidConfigError)
  })

  it('fails on an unknown setting instead of ignoring it', async () => {
    const file = join(workspace, 'typo.yaml')
    await writeFile(file, 'security:\n  followLinks: true\n')

    await expect(loadConfig(file, workspace)).rejects.toThrow(InvalidConfigError)
  })

  it('fails on a file beyond the size limit', async () => {
    const file = join(workspace, 'huge.yaml')
    await writeFile(file, `# ${'a'.repeat(64 * 1024)}\n`)

    await expect(loadConfig(file, workspace)).rejects.toThrow(/exceeds/)
  })

  it('fails on duplicate keys rather than letting one win silently', async () => {
    const file = join(workspace, 'duplicate.yaml')
    await writeFile(file, 'version: 1\nversion: 2\n')

    await expect(loadConfig(file, workspace)).rejects.toThrow(InvalidConfigError)
  })
})
