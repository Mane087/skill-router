#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createContainer } from './container.js'

/**
 * stdout is reserved for the JSON-RPC stream, so every diagnostic goes to
 * stderr. Writing anything else to stdout corrupts the MCP session.
 */
async function main(): Promise<void> {
  const { server, diagnostics } = await createContainer({
    configPath: process.env.SKILL_ROUTER_CONFIG,
  })

  for (const diagnostic of diagnostics) {
    console.error(`skill-router: skipped ${diagnostic.path}: ${diagnostic.reason}`)
  }

  await server.connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  console.error('skill-router-mcp failed to start:', error)
  process.exitCode = 1
})
