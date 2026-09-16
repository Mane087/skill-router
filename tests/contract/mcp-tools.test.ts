import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { createContainer } from '../../src/bootstrap/container.js'
import { canonicalizeRoot } from '../../src/infrastructure/filesystem/safe-path.js'

let workspace: string
let client: Client

function skillDocument(name: string, extra: string): string {
  return `---\nname: ${name}\ndescription: Skill ${name}.\n${extra}---\n\n# ${name}\n\nBody of ${name}.\n`
}

beforeAll(async () => {
  workspace = await canonicalizeRoot(await mkdtemp(join(tmpdir(), 'skill-router-contract-')))
  const globalRoot = join(workspace, 'global-skills')

  await mkdir(join(globalRoot, 'angular', 'references'), { recursive: true })
  await writeFile(
    join(globalRoot, 'angular', 'SKILL.md'),
    skillDocument(
      'angular',
      'phases: [implementation]\nframeworks: [angular]\nlanguages: [typescript]\ntags: [angular, component]\nfilePatterns: ["**/*.component.ts"]\n',
    ),
  )
  await writeFile(
    join(globalRoot, 'angular', 'references', 'component-testing.md'),
    '# Component testing\n\nHow to test a component.\n',
  )

  await mkdir(join(globalRoot, 'postgres'), { recursive: true })
  await writeFile(
    join(globalRoot, 'postgres', 'SKILL.md'),
    skillDocument('postgres', 'phases: [implementation]\nframeworks: [postgres]\ntags: [sql]\n'),
  )

  await writeFile(
    join(workspace, 'config.yaml'),
    `version: 1\nroots:\n  global: ["${globalRoot}"]\n  project: []\n`,
  )

  const { server } = await createContainer({
    configPath: join(workspace, 'config.yaml'),
    cwd: workspace,
  })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'contract-test-client', version: '0.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
})

afterAll(async () => {
  await client.close()
  await rm(workspace, { recursive: true, force: true })
})

interface SearchResponse {
  skills: { id: string; scope: string; score: number; reasons: string[] }[]
}

interface SkillResponse {
  id: string
  scope: string
  name: string
  body: string
  references: string[]
}

interface ReferenceResponse {
  skillId: string
  reference: string
  content: string
}

// A successful tool result carries its payload as JSON text. One reader per
// shape, rather than a generic one, keeps the assertion explicit at each use.
const asSearch = (text: string): SearchResponse => JSON.parse(text) as SearchResponse
const asSkill = (text: string): SkillResponse => JSON.parse(text) as SkillResponse
const asReference = (text: string): ReferenceResponse => JSON.parse(text) as ReferenceResponse

/** The text payload of a tool result, which is JSON for a successful call. */
async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args })
  const [first] = result.content as { type: string; text: string }[]

  return { isError: result.isError === true, text: first?.text ?? '' }
}

describe('tools/list', () => {
  it('advertises the three operations of the first version', async () => {
    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'skills_get',
      'skills_get_reference',
      'skills_search',
    ])
  })

  it('names every tool in a form the Anthropic API accepts', async () => {
    const { tools } = await client.listTools()

    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/)
    }
  })

  it('describes what each tool is for', async () => {
    const { tools } = await client.listTools()

    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('declares the search input schema', async () => {
    const { tools } = await client.listTools()
    const search = tools.find((tool) => tool.name === 'skills_search')

    expect(Object.keys(search?.inputSchema.properties ?? {}).sort()).toEqual([
      'files',
      'keywords',
      'limit',
      'phase',
      'stack',
      'task',
    ])
  })
})

describe('skills_search', () => {
  it('returns the skills relevant to a task', async () => {
    const { isError, text } = await call('skills_search', {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular', 'typescript'],
      files: ['src/app/users.component.ts'],
    })

    expect(isError).toBe(false)
    expect(asSearch(text)).toMatchObject({
      skills: [{ id: 'global:angular', scope: 'global' }],
    })
  })

  it('explains why each skill was selected', async () => {
    const { text } = await call('skills_search', {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular'],
    })

    const [first] = asSearch(text).skills

    expect(first?.reasons).toContain('framework matched angular')
  })

  it('leaves out skills that are not relevant', async () => {
    const { text } = await call('skills_search', {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular'],
    })

    const ids = asSearch(text).skills.map((skill) => skill.id)

    expect(ids).not.toContain('global:postgres')
  })

  it('honours the requested limit', async () => {
    const { text } = await call('skills_search', { task: 'work with sql', limit: 1 })

    expect(asSearch(text).skills.length).toBeLessThanOrEqual(1)
  })

  it('rejects a call with no task, before the use case ever runs', async () => {
    const { isError, text } = await call('skills_search', {})

    expect(isError).toBe(true)
    expect(text).toContain('Invalid arguments for tool skills_search')
  })

  it('rejects an argument of the wrong type', async () => {
    const { isError } = await call('skills_search', { task: 'x', stack: 'angular' })

    expect(isError).toBe(true)
  })

  it('rejects a phase outside the supported lifecycle', async () => {
    const { isError } = await call('skills_search', { task: 'x', phase: 'deployment' })

    expect(isError).toBe(true)
  })

  it('reports an unusable task as an error result', async () => {
    const { isError, text } = await call('skills_search', { task: '   ' })

    expect(isError).toBe(true)
    expect(text).toContain('INVALID_SKILL_QUERY')
  })
})

describe('skills_get', () => {
  it('returns the body and the available references', async () => {
    const { isError, text } = await call('skills_get', { id: 'global:angular' })

    expect(isError).toBe(false)
    expect(asSkill(text)).toMatchObject({
      id: 'global:angular',
      scope: 'global',
      name: 'angular',
      references: ['component-testing'],
    })
  })

  it('returns the markdown without its frontmatter', async () => {
    const { text } = await call('skills_get', { id: 'global:angular' })

    const { body } = asSkill(text)

    expect(body).toContain('# angular')
    expect(body).not.toContain('name: angular')
  })

  it('reports an unknown skill as an error result', async () => {
    const { isError, text } = await call('skills_get', { id: 'global:svelte' })

    expect(isError).toBe(true)
    expect(text).toContain('SKILL_NOT_FOUND')
  })

  it('reports a malformed identity as an error result', async () => {
    const { isError, text } = await call('skills_get', { id: 'angular' })

    expect(isError).toBe(true)
    expect(text).toContain('INVALID_SKILL_ID')
  })

  it('does not find a global skill under the project scope', async () => {
    const { isError } = await call('skills_get', { id: 'project:angular' })

    expect(isError).toBe(true)
  })
})

describe('skills_get_reference', () => {
  it('returns the content of a reference', async () => {
    const { isError, text } = await call('skills_get_reference', {
      skillId: 'global:angular',
      reference: 'component-testing',
    })

    expect(isError).toBe(false)
    expect(asReference(text).content).toContain('How to test a component.')
  })

  it('reports a reference the skill does not have', async () => {
    const { isError, text } = await call('skills_get_reference', {
      skillId: 'global:angular',
      reference: 'missing',
    })

    expect(isError).toBe(true)
    expect(text).toContain('REFERENCE_NOT_FOUND')
  })

  it('refuses to escape the skill directory', async () => {
    const { isError, text } = await call('skills_get_reference', {
      skillId: 'global:angular',
      reference: '../../../etc/passwd',
    })

    expect(isError).toBe(true)
    expect(text).toContain('UNSAFE_PATH')
  })

  it('refuses a reference of a skill that does not exist', async () => {
    const { isError, text } = await call('skills_get_reference', {
      skillId: 'global:svelte',
      reference: 'anything',
    })

    expect(isError).toBe(true)
    expect(text).toContain('SKILL_NOT_FOUND')
  })
})

describe('progressive disclosure', () => {
  it('lets an agent go from a task to one reference without loading the catalog', async () => {
    const search = await call('skills_search', {
      task: 'create an angular component',
      phase: 'implementation',
      stack: ['angular'],
    })
    const [best] = asSearch(search.text).skills

    const skill = await call('skills_get', { id: best!.id })
    const [reference] = asSkill(skill.text).references

    const document = await call('skills_get_reference', {
      skillId: best!.id,
      reference: reference!,
    })

    expect(asReference(document.text).content).toContain('Component testing')
  })
})
