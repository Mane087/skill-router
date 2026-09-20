import { fileURLToPath } from 'node:url'

/**
 * Where Bun places the entry point of a `bun build --compile` binary.
 *
 * `/$bunfs/root/<asset>` on Linux and macOS, `B:\~BUN\root\<asset>` on
 * Windows. Matched against the converted path rather than the URL: the two
 * are not the same text, and the Windows form only becomes recognisable once
 * `fileURLToPath` has decoded it. Separators are normalised and the
 * comparison is lowercased, so a unit test on any platform sees what the
 * binary would see.
 *
 * The Windows form is anchored to its drive letter. `~bun` is a plausible
 * directory name, and a path that merely contains it belongs to whoever
 * created it, not to Bun.
 */
const BUNFS_ROOT = '/$bunfs/'
const BUN_DRIVE_ROOT = /(^|\/)b:\/~bun\//

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
  const entryPath = fileURLToPath(entryUrl)

  if (isCompiledEntryPath(entryPath)) {
    return [process.execPath]
  }

  return [process.execPath, entryPath]
}

/**
 * Whether a resolved entry point is Bun's, rather than a file on disk.
 *
 * Exported because the Windows form cannot be reached through
 * `resolveServerCommand` from anywhere else: `fileURLToPath` only produces
 * `B:\~BUN\…` when it runs on Windows, and the suite runs on Node wherever
 * it is checked out. A test gives it the path the binary would see.
 */
export function isCompiledEntryPath(entryPath: string): boolean {
  const normalised = entryPath.toLowerCase().replaceAll('\\', '/')

  return normalised.includes(BUNFS_ROOT) || BUN_DRIVE_ROOT.test(normalised)
}
