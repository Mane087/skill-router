/**
 * Identity reported during the MCP `initialize` handshake.
 *
 * Kept as literals so the server has no filesystem dependency at startup.
 * It must stay in sync with `package.json`, and
 * `tests/unit/adapters/mcp/server-metadata.test.ts` fails when it is not:
 * the same value is printed by `--version` and sent in the handshake, so a
 * stale constant makes a bug report name a version that was never released.
 */
export const SERVER_NAME = 'skill-router-mcp'
export const SERVER_VERSION = '0.2.2'
