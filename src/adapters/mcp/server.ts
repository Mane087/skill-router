import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { SERVER_NAME, SERVER_VERSION } from './server-metadata.js'

export interface McpServerIdentity {
  readonly name: string
  readonly version: string
}

/**
 * Builds the MCP server shell.
 *
 * No tool is registered yet: routing tools arrive in phase 6, and each one will
 * delegate straight to an application use case (architecture rule 3).
 *
 * Capabilities are intentionally left to the SDK. `McpServer` registers the
 * `tools` capability together with the `tools/list` and `tools/call` handlers
 * when the first tool is registered, so declaring it up front would advertise a
 * capability that has no handler behind it.
 */
export function createMcpServer(identity: McpServerIdentity = defaultIdentity()): McpServer {
  return new McpServer({ name: identity.name, version: identity.version })
}

function defaultIdentity(): McpServerIdentity {
  return { name: SERVER_NAME, version: SERVER_VERSION }
}
