import { INSTALL_CLIENTS, INSTALL_SCOPES, DEFAULT_SERVER_NAME } from './arguments.js'

/** The whole command line, in the order somebody meets it. */
export const USAGE = `skill-router-mcp — ranks and retrieves agent skills over MCP.

Usage
  skill-router-mcp                     Serve over stdio. This is how an MCP client launches it.
  skill-router-mcp serve               The same, spelled out.
  skill-router-mcp install <client>    Register this server with an agent CLI.
  skill-router-mcp --help              Show this.
  skill-router-mcp --version           Print the server version.

Clients
  claude      Runs "claude mcp add". Supports both scopes.
  codex       Runs "codex mcp add". User scope only: Codex keeps every MCP
              server in ~/.codex/config.toml and has no per-project config.
  opencode    Merges into opencode.json. Its own "opencode mcp add" cannot take
              the command of a local server, so the file is edited directly.

Install options
  --name <name>     Name to register under. Default: ${DEFAULT_SERVER_NAME}.
  --scope <scope>   ${INSTALL_SCOPES.join(' or ')}. Default: user.
  --force           Replace an entry that already exists under that name.
  --dry-run         Print what would happen and change nothing.

Examples
  skill-router-mcp install claude
  skill-router-mcp install opencode --scope project
  skill-router-mcp install ${INSTALL_CLIENTS[2]} --name skills --force --dry-run`
