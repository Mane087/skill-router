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

## Consequences

**Codex refuses a project scope** instead of silently widening it to the whole
machine. It has no per-project MCP configuration, and a scope flag that quietly
means something else is worse than an error that names the file.

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
