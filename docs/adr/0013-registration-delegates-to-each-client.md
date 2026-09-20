# 13. Registration delegates to each client's own CLI

Status: accepted

## Context

Connecting this server to an agent means writing a launch command into that
agent's configuration. Three clients, three places:

| Client   | Where it lives                                       |
| -------- | ---------------------------------------------------- |
| claude   | managed by `claude mcp add`, per scope               |
| codex    | `~/.codex/config.toml`, managed by `codex mcp add`   |
| opencode | `opencode.json`, in the project or under `~/.config` |

Doing it by hand is where a working setup turns into a support thread: the
command has to be an absolute path, the file formats differ, and two of the
three are formats this project has no business parsing.

Checking what each CLI actually accepts changed the shape of the command:

- `claude mcp add <name> <commandOrUrl> [args...]` and
  `codex mcp add <NAME> -- <COMMAND>...` both need the launch command. Neither
  takes a bare name.
- `opencode mcp add` exists, but its only options are `--url`, `--env` and
  `--header`. There is no way to give it the command of a local server, so it
  prompts — and a prompt is not something an install command can drive.

## Decision

`skill-router-mcp install <claude|codex|opencode>`.

Claude Code and Codex are asked through their own CLI. Each keeps ownership of
its format, which matters because both have changed it before and a file
written behind their back is a file they may rewrite without warning.

opencode is the exception and its file is merged directly, because it offers no
non-interactive alternative. Merged, not written: every other server and every
unrelated setting survives, and an entry that already exists under the same name
is refused unless `--force` says otherwise.

The asymmetry is kept visible in the code rather than hidden behind a uniform
abstraction that would have to lie about one of the three.

**What gets registered is an absolute path to this build, run with
`process.execPath`.** Two reasons, both discovered rather than assumed:

1. The npm name `skill-router-mcp` belongs to an unrelated package, published by
   somebody else. Registering `npx skill-router-mcp` would point every agent at
   a stranger's code.
2. An agent is started by a desktop application or a login shell whose PATH
   rarely matches the terminal the install ran in, and a version manager makes
   "node" mean different things in each. On the machine this was built on,
   `process.execPath` is `~/.nvm/versions/node/v24.20.0/bin/node`, which a
   desktop-launched agent would not have found.

The binary keeps serving when it is given no argument, so adding subcommands
changed nothing about how any client launches it.

**A compiled binary registers as itself, with no second element.** Both reasons
above are about finding an interpreter, and a `bun build --compile` binary
carries its own: `process.execPath` is the binary rather than a runtime, and
its entry point resolves inside Bun's virtual filesystem (`/$bunfs/root/…`,
`B:\~BUN\…` on Windows), a path no process can open. Registering the pair gave
the binary its own virtual path as a subcommand, which it rejected, so every
client reported a closed connection. The executable alone becomes the command,
which works because the binary serves when it is given no argument.

The check reads the **resolved path**, not `import.meta.url`. The first attempt
matched the URL and shipped, because a unit test on Node cannot tell the two
apart; the release smoke test then caught the Windows binary still registering
its virtual path. A `file:` URL and the path it converts to are not the same
text, and the path is what the binary is handed. The Windows form is anchored
to Bun's drive letter, since `~bun` is a directory anybody may create.

## Detecting the client

Installing into a client that is not on the machine fails: `claude mcp add`
cannot run if there is no `claude`, and writing an `opencode.json` for a tool
nobody has is noise. But failing is the wrong answer, because running all three
install commands on a machine that has one of them is a setup script and not a
mistake.

So each client is detected first, and an absent one is **skipped with exit 0**.

Presence is two signals, because each alone is wrong in a case that happens:

- **Its directory** — `~/.claude`, `~/.codex`, `~/.opencode`, and for opencode
  also `~/.config/opencode`, since the first holds the installation and the
  second the configuration and a machine can have either without the other. A
  client that has been used has one. A client installed but never run does not,
  so the directory alone would skip an install that would have worked.
- **Its executable on PATH** — present from the moment it is installed. But a
  process started by an editor or a launcher routinely has a PATH that omits it,
  so the executable alone would skip a client that is plainly there.

Either is enough. The executable is resolved by reading PATH rather than by
spawning anything: asking the operating system to run a program in order to find
out whether it exists runs it.

The scope is validated **before** the machine is inspected. A command that is
wrong is wrong everywhere, and `install codex --scope project` must fail on a
machine without Codex too — otherwise a script appears to work on one developer's
machine and silently does nothing on another's.

## Consequences

**Codex refuses a project scope** instead of silently widening it to the whole
machine. It has no per-project MCP configuration, and a scope flag that quietly
means something else is worse than an error that names the file.

**A skip is not a silence.** It prints the client, every directory it looked in
and the executable it looked for, so "nothing happened" is always accompanied by
why.

**A dry run is part of the command, not a debugging aid.** `--dry-run` prints
the exact `claude mcp add …` line or the exact `opencode.json` entry. It is also
how the Claude Code and Codex paths are exercised without mutating the
developer's real configuration.

**Arguments never reach a shell.** The process runner spawns with `shell: false`
and passes a list, so a `--name` is an argument and can never be a command.

**A missing CLI is exit code 127, not an exception.** Callers already have to
handle "the CLI refused"; making "the CLI is absent" the same shape means the
message can name it — and the message repeats the command so the registration
can still be done by hand.

**`bin` moved** from `dist/bootstrap/start-stdio.js` to `dist/bootstrap/main.js`,
which dispatches. `start-stdio.ts` is now a module exporting `startStdio()`. The
release workflow compiles the new entry point, or the released binaries would
serve but not install.

**The registration is proven by launching it.** A unit test cannot reach the
compiled case: it runs on Node, where the entry point is a real file. So the
release smoke test now runs `install claude --dry-run` against each binary,
parses the command it plans to register and completes an MCP handshake with
exactly that command. Serving and registering were two claims and only the
first was checked.
