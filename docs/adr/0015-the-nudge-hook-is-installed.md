# 15. The nudge hook is installed, not documented

Status: accepted

## Context

Registering the server makes its tools available. It does not make an agent
reach for them. Claude Code and Codex both look for skills the direct way —
`Skill`, or `Read`, `Glob` and `Grep` over a catalogue of `SKILL.md` files —
and reading that catalogue costs far more context than asking the router which
skill is relevant.

Both clients fire a `PreToolUse` event, and both let a shell script answer it
with text the model sees. A script that says the router exists, once per
session and only when the agent is about to go looking for skills by hand, is
enough to change the behaviour. Writing that script and its registration by
hand is three files in two formats, which is the problem `install` already
exists to solve.

The scripts themselves live in `assets/` and are the product of trial: Claude
Code names the fields of `tool_input` predictably, Codex does not, so the Codex
script pulls every string out of the object instead of reading `file_path`.

## Decision

`skill-router-mcp install <claude|codex> --hook` installs the hook as well as
the registration. It writes two files:

| Client | Script                                    | Registration                                  |
| ------ | ----------------------------------------- | --------------------------------------------- |
| claude | `~/.claude/hooks/skill-router-nudge.sh`   | `~/.claude/settings.json`, `hooks.PreToolUse` |
| codex  | `$CODEX_HOME/hooks/skill-router-nudge.sh` | `$CODEX_HOME/hooks.json`, `hooks.PreToolUse`  |

Four things follow from what the clients are, rather than from taste:

**The matcher differs.** Claude Code gets `Skill|Read|Glob|Grep`, the tools it
uses to find a skill. Codex gets `.*`, because its script already decides for
itself: it skips calls to this very server, then searches every string in
`tool_input` for a skills directory. Narrowing it would split one decision
across two files that can drift apart.

**opencode is refused.** It has plugins, not `PreToolUse` hooks. `--hook` with
opencode is a usage error rather than a flag that quietly does nothing, so a
setup script cannot appear to have installed something it did not.

**`jq` is a requirement, checked first.** The script parses the tool call and
prints its answer with `jq`; without it every tool call would run a hook that
fails. The check runs before the server is registered, so the command either
happens or does not.

**The hook is user-level only.** Both files live in the user's home directory,
so `--hook --scope project` is refused rather than silently installed
somewhere else.

The scripts are copied into a generated TypeScript module by
`scripts/generate-hook-assets.mjs`. The released binary is one file produced by
`bun build --compile`, so only what the bundle imports travels with it: a `.sh`
read from disk at install time would not exist on the machine that downloaded
the binary. A unit test compares the module against the files, so forgetting to
regenerate fails the suite instead of shipping a stale script.

## Consequences

The hook runs on tool calls the agent makes constantly, which is why it exits
early on anything that is not about skills and marks the session the first time
it speaks. A slow or noisy hook would be worse than none.

Both configuration files are merged, never rewritten. They hold everything from
other people's hooks to a theme, and an entry under this name that does not
match what would be written was edited by somebody: it is protected until
`--force` says otherwise. The entry is recognized by the script it runs, since
these entries have no name, which is also what keeps a second install from
leaving a second copy.

`CODEX_HOME` is honoured when resolving where to write, because the command
that gets written resolves it too. A machine that moves Codex's home moves both
halves together.

The nudge is advice, not enforcement: it adds context and never blocks a tool
call. An agent that ignores it loses nothing but context.
