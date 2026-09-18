import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createContainer } from './container.js'

/**
 * Serves the MCP session over stdio.
 *
 * stdout is reserved for the JSON-RPC stream, so every diagnostic goes to
 * stderr. Writing anything else to stdout corrupts the MCP session.
 */
export async function startStdio(): Promise<void> {
  const { server, diagnostics } = await createContainer({
    configPath: process.env.SKILL_ROUTER_CONFIG,
  })

  // Not all of these are skips: a skill can load and still be worth reporting,
  // which is what a manifest carrying fields this project does not define does.
  for (const diagnostic of diagnostics) {
    console.error(`skill-router: ${diagnostic.path}: ${diagnostic.reason}`)
  }

  await server.connect(new StdioServerTransport())
}
