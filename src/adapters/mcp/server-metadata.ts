/**
 * Identity reported during the MCP `initialize` handshake.
 *
 * Kept as literals so the server has no filesystem dependency at startup.
 * It must stay in sync with `package.json`; a release check enforces that
 * once the release workflow exists (phase 11).
 */
export const SERVER_NAME = 'skill-router-mcp'
export const SERVER_VERSION = '0.1.0'
