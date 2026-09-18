import { fileURLToPath } from 'node:url'

/**
 * The command a client should run to launch this server.
 *
 * An absolute path to the entry point, not a package name. The npm name
 * `skill-router-mcp` belongs to somebody else, so registering
 * `npx skill-router-mcp` with an agent would point it at a stranger's code.
 *
 * The interpreter is `process.execPath`, not the string "node". An agent is
 * started by a desktop application or a login shell whose PATH rarely matches
 * the terminal this ran in, and a version manager makes "node" mean different
 * things in each. Pinning the running interpreter makes the registration work
 * where the agent will actually read it.
 *
 * @param entryUrl `import.meta.url` of the binary entry point.
 */
export function resolveServerCommand(entryUrl: string): readonly string[] {
  return [process.execPath, fileURLToPath(entryUrl)]
}
