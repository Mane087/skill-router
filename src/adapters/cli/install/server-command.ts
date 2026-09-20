import { fileURLToPath } from 'node:url'

/**
 * Where Bun places the entry point of a `bun build --compile` binary.
 *
 * `/$bunfs/root/<asset>` on Linux and macOS, `B:\~BUN\root\<asset>` on
 * Windows. Both are matched against the URL with its separators normalised,
 * so the Windows form is recognised while running on any platform, and
 * `fileURLToPath` is never asked to convert a path no process can open.
 */
const COMPILED_ENTRY_MARKERS = ['/$bunfs/', '/~bun/']

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
 * A compiled binary is the exception, and it is the artifact most people run.
 * There `process.execPath` is already the binary rather than an interpreter,
 * and the entry point resolves inside Bun's virtual filesystem, a path that
 * does not exist on disk. Passing that pair to a client registers the binary
 * with its own virtual path as a subcommand, which it rejects, so the server
 * never connects. The binary serves when it is given no argument, which is
 * what ADR-0013 relies on, so the executable alone is the whole command.
 *
 * @param entryUrl `import.meta.url` of the binary entry point.
 */
export function resolveServerCommand(entryUrl: string): readonly string[] {
  if (isCompiledEntry(entryUrl)) {
    return [process.execPath]
  }

  return [process.execPath, fileURLToPath(entryUrl)]
}

function isCompiledEntry(entryUrl: string): boolean {
  const normalised = entryUrl.toLowerCase().replaceAll('\\', '/')

  return COMPILED_ENTRY_MARKERS.some((marker) => normalised.includes(marker))
}
