import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installInOpencode } from '../../src/adapters/cli/install/opencode-client.js'
import { CliFailureError, CliUsageError } from '../../src/adapters/cli/errors.js'
import type { InstallRequest } from '../../src/adapters/cli/install/install-request.js'
import type { OpencodeEnvironment } from '../../src/adapters/cli/install/opencode-client.js'

const COMMAND = ['node', '/opt/skill-router/dist/bootstrap/main.js']

const REQUEST: InstallRequest = {
  name: 'skill-router',
  scope: 'project',
  command: COMMAND,
  force: false,
  dryRun: false,
}

const ENTRY = { type: 'local', command: COMMAND, enabled: true }

let workspace: string
let counter = 0

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'skill-router-opencode-'))
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

async function makeEnvironment(existing?: unknown): Promise<OpencodeEnvironment> {
  counter += 1
  const cwd = join(workspace, `case-${String(counter)}`)
  await mkdir(cwd, { recursive: true })

  if (existing !== undefined) {
    await writeFile(
      join(cwd, 'opencode.json'),
      typeof existing === 'string' ? existing : `${JSON.stringify(existing, null, 2)}\n`,
    )
  }

  return { cwd, home: join(cwd, 'home'), configHome: undefined }
}

function readConfig(environment: OpencodeEnvironment): Promise<string> {
  return readFile(join(environment.cwd, 'opencode.json'), 'utf8')
}

describe('installInOpencode on a project that has no configuration yet', () => {
  it('creates the file with the server registered', async () => {
    const environment = await makeEnvironment()

    const outcome = await installInOpencode(REQUEST, environment)

    expect(outcome.action).toBe('added')
    expect(JSON.parse(await readConfig(environment))).toEqual({
      $schema: 'https://opencode.ai/config.json',
      mcp: { 'skill-router': ENTRY },
    })
  })

  it('writes a local server, because this one speaks stdio and is not a URL', async () => {
    const environment = await makeEnvironment()

    await installInOpencode(REQUEST, environment)
    const config = JSON.parse(await readConfig(environment)) as {
      mcp: Record<string, { type: string; enabled: boolean }>
    }

    expect(config.mcp['skill-router']).toMatchObject({ type: 'local', enabled: true })
  })

  it('ends the file with a newline, like every other file in this repository', async () => {
    const environment = await makeEnvironment()

    await installInOpencode(REQUEST, environment)

    expect(await readConfig(environment)).toMatch(/\n$/)
  })
})

describe('installInOpencode on a project that already has configuration', () => {
  const EXISTING = {
    $schema: 'https://opencode.ai/config.json',
    mcp: { context7: { type: 'remote', url: 'https://mcp.context7.com/mcp', enabled: true } },
    share: 'disabled',
  }

  it('keeps every other server and every unrelated setting', async () => {
    const environment = await makeEnvironment(EXISTING)

    await installInOpencode(REQUEST, environment)
    const config = JSON.parse(await readConfig(environment)) as Record<string, unknown>

    expect(config).toEqual({
      ...EXISTING,
      mcp: { ...EXISTING.mcp, 'skill-router': ENTRY },
    })
  })

  it('reports no change when the entry is already exactly what it would write', async () => {
    const environment = await makeEnvironment({ ...EXISTING, mcp: { 'skill-router': ENTRY } })
    const before = await readConfig(environment)

    const outcome = await installInOpencode(REQUEST, environment)

    expect(outcome.action).toBe('unchanged')
    expect(await readConfig(environment)).toBe(before)
  })

  it('refuses to overwrite a different entry without --force', async () => {
    const environment = await makeEnvironment({
      mcp: { 'skill-router': { type: 'local', command: ['old-binary'], enabled: false } },
    })

    await expect(installInOpencode(REQUEST, environment)).rejects.toBeInstanceOf(CliUsageError)
  })

  it('leaves the file untouched when it refuses', async () => {
    const environment = await makeEnvironment({
      mcp: { 'skill-router': { type: 'local', command: ['old-binary'] } },
    })
    const before = await readConfig(environment)

    await expect(installInOpencode(REQUEST, environment)).rejects.toThrow()

    expect(await readConfig(environment)).toBe(before)
  })

  it('replaces the entry when forced', async () => {
    const environment = await makeEnvironment({
      mcp: { 'skill-router': { type: 'local', command: ['old-binary'] } },
    })

    const outcome = await installInOpencode({ ...REQUEST, force: true }, environment)
    const config = JSON.parse(await readConfig(environment)) as { mcp: Record<string, unknown> }

    expect(outcome.action).toBe('updated')
    expect(config.mcp['skill-router']).toEqual(ENTRY)
  })

  it('adds the schema reference to a file that has none', async () => {
    const environment = await makeEnvironment({ share: 'disabled' })

    await installInOpencode(REQUEST, environment)
    const config = JSON.parse(await readConfig(environment)) as Record<string, unknown>

    expect(config.$schema).toBe('https://opencode.ai/config.json')
  })

  it('keeps a schema reference the author had already chosen', async () => {
    const environment = await makeEnvironment({ $schema: './local-schema.json' })

    await installInOpencode(REQUEST, environment)
    const config = JSON.parse(await readConfig(environment)) as Record<string, unknown>

    expect(config.$schema).toBe('./local-schema.json')
  })
})

describe('installInOpencode when the file cannot be used', () => {
  it.each([
    ['malformed JSON', '{ "mcp": '],
    ['a top-level array', '[]'],
    ['a top-level scalar', '"nope"'],
    ['an mcp field that is not a mapping', '{ "mcp": [] }'],
  ])('refuses %s rather than overwriting it', async (_label, content) => {
    const environment = await makeEnvironment(content)

    await expect(installInOpencode(REQUEST, environment)).rejects.toBeInstanceOf(CliFailureError)
    expect(await readConfig(environment)).toBe(content)
  })
})

describe('installInOpencode scopes and dry runs', () => {
  it('writes nothing on a dry run, and names the file it would have written', async () => {
    const environment = await makeEnvironment()

    const outcome = await installInOpencode({ ...REQUEST, dryRun: true }, environment)

    expect(outcome.action).toBe('planned')
    expect(outcome.summary).toContain(join(environment.cwd, 'opencode.json'))
    await expect(readConfig(environment)).rejects.toThrow()
  })

  it('writes to the user configuration directory for a user scope', async () => {
    const environment = await makeEnvironment()

    await installInOpencode({ ...REQUEST, scope: 'user' }, environment)

    const written = await readFile(
      join(environment.home, '.config', 'opencode', 'opencode.json'),
      'utf8',
    )
    expect(JSON.parse(written)).toMatchObject({ mcp: { 'skill-router': ENTRY } })
  })

  it('honours XDG_CONFIG_HOME, which is where the file actually lives on this platform', async () => {
    const base = await makeEnvironment()
    const environment = { ...base, configHome: join(base.cwd, 'xdg') }

    await installInOpencode({ ...REQUEST, scope: 'user' }, environment)

    const written = await readFile(join(base.cwd, 'xdg', 'opencode', 'opencode.json'), 'utf8')
    expect(JSON.parse(written)).toMatchObject({ mcp: { 'skill-router': ENTRY } })
  })

  it('registers under the requested name', async () => {
    const environment = await makeEnvironment()

    await installInOpencode({ ...REQUEST, name: 'skills' }, environment)
    const config = JSON.parse(await readConfig(environment)) as { mcp: Record<string, unknown> }

    expect(Object.keys(config.mcp)).toEqual(['skills'])
  })
})
