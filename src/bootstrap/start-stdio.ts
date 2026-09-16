#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createMcpServer } from '../adapters/mcp/server.js'

/**
 * stdout is reserved for the JSON-RPC stream, so every diagnostic goes to
 * stderr. Writing anything else to stdout corrupts the MCP session.
 */
async function main(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  console.error('skill-router-mcp failed to start:', error)
  process.exitCode = 1
})
