import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { createMcpServer } from '../../src/adapters/mcp/server.js'
import { SERVER_NAME, SERVER_VERSION } from '../../src/adapters/mcp/server-metadata.js'
import type { McpServerIdentity } from '../../src/adapters/mcp/server.js'

async function connect(identity?: McpServerIdentity): Promise<Client> {
  const server = identity ? createMcpServer(identity) : createMcpServer()
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'contract-test-client', version: '0.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  return client
}

describe('MCP server contract', () => {
  it('completes the initialize handshake reporting its own identity', async () => {
    const client = await connect()

    expect(client.getServerVersion()).toMatchObject({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    })

    await client.close()
  })

  it('does not advertise a tools capability before any tool is registered', async () => {
    const client = await connect()

    expect(client.getServerCapabilities()?.tools).toBeUndefined()

    await client.close()
  })

  it('rejects tools/list while no tool exists, since routing lands in a later phase', async () => {
    const client = await connect()

    await expect(client.listTools()).rejects.toThrow(/Method not found/)

    await client.close()
  })

  it('accepts an explicit identity', async () => {
    const client = await connect({ name: 'custom-router', version: '9.9.9' })

    expect(client.getServerVersion()).toMatchObject({
      name: 'custom-router',
      version: '9.9.9',
    })

    await client.close()
  })
})
