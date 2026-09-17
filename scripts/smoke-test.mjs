#!/usr/bin/env node
// Exercises a built server the way a client does, over real stdio.
//
// The released binary carries the Bun runtime, while the test suite runs on
// Node, so nothing else in this repository proves the artifact people download
// actually starts and answers. This does: it speaks JSON-RPC to the binary
// itself, on the machine it was built for.
//
// Deliberately free of dependencies. It has to run next to a binary, on a
// runner with no install step, which rules out the MCP SDK.
//
// Usage: node scripts/smoke-test.mjs <command> [args...]

import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PROTOCOL_VERSION = '2025-06-18'
const TIMEOUT_MS = 30_000

const [command, ...args] = process.argv.slice(2)

if (command === undefined) {
  fail('Usage: node scripts/smoke-test.mjs <command> [args...]')
}

const workspace = await mkdtemp(join(tmpdir(), 'skill-router-smoke-'))

try {
  await main()
  console.log('\nSmoke test passed.')
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  await rm(workspace, { recursive: true, force: true })
}

async function main() {
  const config = await writeCatalog()
  const server = start(config)

  try {
    const initialized = await server.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0.0' },
    })

    expect(
      typeof initialized.serverInfo?.name === 'string',
      `initialize returned no server name: ${JSON.stringify(initialized)}`,
    )
    report('initialize', `${initialized.serverInfo.name} ${initialized.serverInfo.version}`)

    server.notify('notifications/initialized')

    const listed = await server.request('tools/list')
    const tools = (listed.tools ?? []).map((tool) => tool.name).sort()

    expect(
      equal(tools, ['skills_get', 'skills_get_reference', 'skills_search']),
      `tools/list returned ${JSON.stringify(tools)}`,
    )
    report('tools/list', tools.join(', '))

    const searched = await server.request('tools/call', {
      name: 'skills_search',
      arguments: { task: 'Create an Angular component', phase: 'implementation' },
    })
    const found = parseToolResult(searched, 'skills_search')

    expect(
      found.skills?.[0]?.id === 'global:angular',
      `skills_search ranked ${JSON.stringify(found.skills)} first`,
    )
    report('skills_search', `${found.skills[0].id} scored ${String(found.skills[0].score)}`)

    const got = await server.request('tools/call', {
      name: 'skills_get',
      arguments: { id: 'global:angular' },
    })
    const skill = parseToolResult(got, 'skills_get')

    expect(
      typeof skill.body === 'string' && skill.body.length > 0,
      `skills_get returned no body: ${JSON.stringify(skill)}`,
    )
    report('skills_get', `${String(skill.body.length)} bytes`)

    const reference = await server.request('tools/call', {
      name: 'skills_get_reference',
      arguments: { skillId: 'global:angular', reference: 'components' },
    })
    const content = parseToolResult(reference, 'skills_get_reference')

    expect(
      typeof content.content === 'string' && content.content.includes('reference'),
      `skills_get_reference returned ${JSON.stringify(content)}`,
    )
    report('skills_get_reference', `${String(content.content.length)} bytes`)

    // An unknown id has to come back as a tool error rather than a crash: this
    // is the path a client hits most often after a stale search result.
    const missing = await server.request('tools/call', {
      name: 'skills_get',
      arguments: { id: 'global:does-not-exist' },
    })

    expect(
      missing.isError === true,
      `a missing skill was not reported as an error: ${JSON.stringify(missing)}`,
    )
    report('error path', firstText(missing).split('.')[0])
  } finally {
    await server.stop()
  }
}

/** A catalog small enough to assert on, written where the server can read it. */
async function writeCatalog() {
  const root = join(workspace, 'skills')
  const skill = join(root, 'angular')

  await mkdir(join(skill, 'references'), { recursive: true })
  await writeFile(
    join(skill, 'SKILL.md'),
    [
      '---',
      'name: angular',
      'description: Angular practices for building and testing components.',
      'phases:',
      '  - implementation',
      'frameworks:',
      '  - angular',
      '---',
      '',
      '# Angular',
      '',
      'Body read by the smoke test.',
      '',
    ].join('\n'),
  )
  await writeFile(
    join(skill, 'references', 'components.md'),
    '# Components\n\nA reference document read by the smoke test.\n',
  )

  const config = join(workspace, 'skill-router.config.yaml')

  await writeFile(
    config,
    ['version: 1', 'roots:', '  global:', `    - '${root}'`, '  project: []', ''].join('\n'),
  )

  return config
}

/** A JSON-RPC client over the child's stdio, one message per line. */
function start(config) {
  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SKILL_ROUTER_CONFIG: config },
  })

  const pending = new Map()
  const stderr = []
  let nextId = 0
  let buffer = ''
  let exit = null

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk

    let newline = buffer.indexOf('\n')

    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')

      if (line.length > 0) {
        deliver(line)
      }
    }
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => stderr.push(chunk))

  child.on('error', (error) => {
    exit = `the server could not be started: ${error.message}`
    rejectAll()
  })

  child.on('exit', (code, signal) => {
    exit = `the server exited early with ${signal ?? `code ${String(code)}`}`
    rejectAll()
  })

  function deliver(line) {
    let message

    try {
      message = JSON.parse(line)
    } catch {
      // Anything that is not a message is the server writing to the wrong
      // stream, which corrupts the session and is worth failing on.
      rejectAll(`the server wrote this to stdout: ${line.slice(0, 200)}`)
      return
    }

    const handlers = pending.get(message.id)

    if (handlers === undefined) {
      return
    }

    pending.delete(message.id)

    if (message.error !== undefined) {
      handlers.reject(new Error(`${message.error.message} (${String(message.error.code)})`))
      return
    }

    handlers.resolve(message.result)
  }

  function rejectAll(reason = exit) {
    for (const [, handlers] of pending) {
      handlers.reject(new Error(`${reason}${describeStderr(stderr)}`))
    }

    pending.clear()
  }

  return {
    request(method, params) {
      if (exit !== null) {
        return Promise.reject(new Error(`${exit}${describeStderr(stderr)}`))
      }

      nextId += 1
      const id = nextId

      const answered = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })

        setTimeout(() => {
          if (pending.delete(id)) {
            reject(new Error(`${method} timed out after ${String(TIMEOUT_MS / 1000)}s`))
          }
        }, TIMEOUT_MS).unref()
      })

      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)

      return answered
    },

    notify(method, params) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
    },

    async stop() {
      child.stdin.end()
      child.kill()

      await new Promise((resolve) => setTimeout(resolve, 100))
    },
  }
}

function parseToolResult(result, method) {
  const text = firstText(result)

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${method} returned a payload that is not JSON: ${text.slice(0, 200)}`)
  }
}

function firstText(result) {
  return result?.content?.[0]?.text ?? ''
}

function equal(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function report(step, detail) {
  console.log(`  ok  ${step.padEnd(22)} ${detail}`)
}

function describeStderr(stderr) {
  const text = stderr.join('').trim()

  return text.length === 0 ? '' : `\n--- stderr ---\n${text}`
}

function fail(message) {
  console.error(`Smoke test failed: ${message}`)
  process.exit(1)
}
