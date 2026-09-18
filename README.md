<h1 align="center">Skill Router</h1>

<p align="center">
  MCP server that ranks and retrieves agent skills, so an agent loads the smallest
  sufficient context instead of an entire catalog.
</p>

<!-- BADGES -->
<p align="center">
    <a title="CI" href="https://github.com/Mane087/skill-router/actions/workflows/ci.yml">
       <img src="https://github.com/Mane087/skill-router/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a title="Security" href="https://github.com/Mane087/skill-router/actions/workflows/security.yml">
       <img src="https://github.com/Mane087/skill-router/actions/workflows/security.yml/badge.svg" alt="Security" />
    </a>
    <a title="Release" href="https://github.com/Mane087/skill-router/actions/workflows/release.yml">
       <img src="https://github.com/Mane087/skill-router/actions/workflows/release.yml/badge.svg" alt="Release" />
    </a>
    <a title="MIT" href="LICENSE">
       <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
    </a>
    <a title="Model Context Protocol" href="https://modelcontextprotocol.io">
       <img src="https://img.shields.io/badge/MCP%20SDK-1.30-000000?logo=anthropic&logoColor=white" alt="MCP SDK 1.30" />
    </a>
    <a title="TypeScript" href="https://www.typescriptlang.org">
       <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
    </a>
    <a title="Node.js" href="https://nodejs.org">
       <img src="https://img.shields.io/badge/Node.js-%3E%3D24-339933?logo=node.js&logoColor=white" alt="Node.js >= 24" />
    </a>
</p>

## Description

Skill Router is an MCP server that indexes the `SKILL.md` catalogs already present on
a machine, ranks them against a described task, and returns a short list of candidates
with the reason each one was selected. It speaks stdio to any MCP client — Claude Code,
Codex, OpenCode — and ships as a self-contained binary per platform.

Ranking is deterministic: no model call, no network, no embedding index. The same
query against the same catalog always returns the same list in the same order, which is
what makes the routing decision reproducible and testable.

## What problem does it solve?

Coding agents already discover and select skills on their own, and that works while the
catalog is small and each skill is clearly different from the rest.

It stops working as the catalog grows. With a hundred skills the agent has to read a
hundred descriptions, tell overlapping ones apart, and decide what is relevant before
starting the actual task. Progressive disclosure limits how much of each skill is
exposed, but the routing decision still happens inside the agent's context, competing
for attention with the work.

Skill Router moves that decision into a retrieval layer. The agent describes the task
instead of reading the catalog:

```text
task      Add unit tests to an Angular component
phase     testing
stack     angular, typescript
files     src/app/users/users.component.spec.ts
```

and gets back a ranked shortlist, each entry carrying the signals that put it there:

```text
global:angular    framework matched angular
                  file pattern matched **/*.component.ts

global:jest       intent matched testing
                  language matched typescript
```

Only those are loaded. Four things follow from doing the selection this way.

**Every result explains itself, so wrong ones are findable.** `reasons` is never empty
and lists only the signals that actually contributed. A bad result is a bad signal you
can point at, not a judgement you cannot inspect.

**Relevance is a rule, not an impression.** A skill is admitted only if it matches the
_subject_ of the task — framework, language, intent, file or tag — or covers at least a
quarter of the query's content words in its description. Phase alone never admits a
skill, because nearly every skill declares `implementation`. Adding that rule cut the
measured false positive rate from 67% to 39% on the first dataset.

**Scope is explicit.** `global:angular` and `project:angular` are different skills and
coexist, so a repository can extend the shared catalog without every agent
configuration knowing about it beforehand, and a project skill can never silently
shadow a global one.

**Retrieval quality can be measured.** Because selection is a separate system, it can
be scored against a dataset with recall, precision, MRR, NDCG and false positive rate,
instead of remaining an implicit reasoning step nobody can grade.

It does not replace the agent's judgement. It reduces a registry to the smallest useful
candidate set; deciding which of those to actually load, and how to apply them, stays
with the agent.

## Features

- Three MCP tools meant to be used in order — shortlist, then one skill, then one
  reference document — so context is narrowed at every step instead of loaded up front.
- Deterministic ranking over eight signals: phase, framework, language, intent, file
  pattern, tag, description and related skill.
- Works with skills nobody wrote for this project: when a manifest declares only a name
  and a description, ranking falls back to the description (ADR-0011).
- Zero-configuration discovery: with no config file the server scans the directories
  the agents themselves document, under `~/.claude`, `~/.codex`, `~/.config/opencode`,
  `~/.agents` and their project-level counterparts.
- Global and project scopes, with the shadowed copy reported rather than hidden.
- A broken skill never fails the scan: it is reported as a diagnostic on stderr and the
  remaining skills stay usable.
- Errors carry stable codes such as `SKILL_NOT_FOUND` or `UNSAFE_PATH`, so a caller
  never has to match on message text.
- `pnpm eval` scores retrieval against four datasets and compares the run to a stored
  baseline, so a ranking change has to be looked at on purpose.
- Self-contained binaries for Linux, macOS and Windows, each smoke-tested over real
  stdio on the system it was built for and carrying a build provenance attestation.

## Install

Each release carries a binary per platform. Nothing else is needed to run it — no Node,
no package manager:

```bash
curl -fsSL https://raw.githubusercontent.com/Mane087/skill-router/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/Mane087/skill-router/main/install.ps1 | iex
```

Both resolve the latest release, verify the download against the published
`SHA256SUMS`, and put `skill-router-mcp` on your PATH. Set `SKILL_ROUTER_VERSION` to a
release tag, written exactly as the release shows it, and `SKILL_ROUTER_INSTALL_DIR` to
choose where the binary lands.

| Platform | Architectures |
| -------- | ------------- |
| Linux    | x64, arm64    |
| macOS    | x64, arm64    |
| Windows  | x64           |

The provenance attestation records which workflow and commit produced a binary:

```bash
gh attestation verify skill-router-mcp-darwin-arm64 --repo Mane087/skill-router
```

## Connecting an agent

The server speaks MCP over stdio. For Claude Code, add it to `.mcp.json`:

```json
{
  "mcpServers": {
    "skill-router": {
      "command": "skill-router-mcp",
      "env": { "SKILL_ROUTER_CONFIG": "/path/to/skill-router.config.yaml" }
    }
  }
}
```

`SKILL_ROUTER_CONFIG` is optional: without it the server scans the directories the
agents themselves use. From a checkout rather than an installed binary, the command is
`node` with `args: ["/path/to/dist/bootstrap/main.js"]`.

### Registering it for you

`install` writes that registration itself, for the three clients that have a
place to put it:

```bash
skill-router-mcp install claude
skill-router-mcp install codex
skill-router-mcp install opencode --scope project
```

| Client   | How                    | Scopes                                                           |
| -------- | ---------------------- | ---------------------------------------------------------------- |
| claude   | `claude mcp add`       | `user`, `project`                                                |
| codex    | `codex mcp add`        | `user` only — Codex has no per-project MCP configuration         |
| opencode | merges `opencode.json` | `user` (`~/.config/opencode`), `project` (the working directory) |

Claude Code and Codex are asked through their own CLI, so each keeps ownership
of its configuration format. opencode is the exception: `opencode mcp add`
takes `--url`, `--env` and `--header` but no way to give it the command of a
local server, so its file is merged directly — every other server and every
unrelated setting is preserved, and an entry that already exists under the same
name is refused unless `--force` is given.

A client that is not on this machine is **skipped, not failed**: the command
reports it and exits 0, so running all three on a machine that has one of them
is a setup script rather than an error.

```text
$ skill-router-mcp install codex
Skipped: codex is not installed on this machine. Looked for ~/.codex and for "codex" on PATH.
```

A client counts as present when its directory exists (`~/.claude`, `~/.codex`,
`~/.opencode` or `~/.config/opencode`) or when its executable is on PATH. Either
alone is wrong in a case that happens: a client that has never been run has no
directory, and a process started by an editor often has a PATH that does not
include it.

A command that is wrong is still an error everywhere, whatever is installed:
`install codex --scope project` fails on every machine, so a script cannot
appear to work on one and quietly do nothing on another.

`--dry-run` prints what would happen and changes nothing. `--name` registers
under something other than `skill-router`.

The command that gets registered is an absolute path to this build, run with
the interpreter that is running the install. Not `npx skill-router-mcp`: that
npm name belongs to an unrelated package, and an agent launched by a desktop
application rarely shares the PATH of the terminal you typed in.

### The nudge hook

Registering the server makes its tools available; it does not make an agent
reach for them. `--hook` also installs a `PreToolUse` hook that tells the agent
the router is there, once per session, when it is about to go looking for
skills by hand:

```bash
skill-router-mcp install claude --hook
skill-router-mcp install codex --hook
```

| Client | Script                                  | Registered in                                 |
| ------ | --------------------------------------- | --------------------------------------------- |
| claude | `~/.claude/hooks/skill-router-nudge.sh` | `~/.claude/settings.json`, `hooks.PreToolUse` |
| codex  | `~/.codex/hooks/skill-router-nudge.sh`  | `~/.codex/hooks.json`, `hooks.PreToolUse`     |

The script reads the tool call with **`jq`**, so `jq` has to be on PATH. That is
checked before anything is written: without it the command fails and registers
nothing, rather than leaving half an install behind.

`--hook` is not supported for opencode, which has plugins rather than
`PreToolUse` hooks, and it has no project scope: both files it writes live in
your home directory. Both are refused as usage errors instead of quietly doing
nothing.

Both configuration files are merged, so other hooks and unrelated settings
survive. A second run changes nothing. A script or an entry that differs from
what would be written was edited by somebody and is left alone until `--force`
says otherwise, and `--dry-run` names both files without touching either.

The nudge is advice and never blocks a tool call. The scripts it installs are
`assets/hook_claude.sh` and `assets/hook_codex.sh`; edit those and run
`pnpm generate:hooks`.

### The routing-metadata skill

The router ranks on the frontmatter a catalogue declares, and most catalogues
declare only `name` and `description`. `--skill` installs
`skill-router-metadata`, which teaches the agent to write the rest: `phases`,
`intents`, `frameworks`, `languages`, `tags`, `filePatterns`, `related` and
`excludes`.

```bash
skill-router-mcp install claude --skill
skill-router-mcp install codex --hook --skill
skill-router-mcp install opencode --skill
```

| Client   | Installed in                                       |
| -------- | -------------------------------------------------- |
| claude   | `~/.claude/skills/skill-router-metadata/`          |
| codex    | `~/.codex/skills/skill-router-metadata/`           |
| opencode | `~/.config/opencode/skills/skill-router-metadata/` |

`CODEX_HOME` and `XDG_CONFIG_HOME` are followed where the client follows them,
so the skill lands where that client actually reads.

Unlike `--hook`, this works for all three clients, and it always writes to the
global skills directory: a skill is a capability of the agent rather than of a
checkout, so `--scope` does not reach it. `install claude --scope project
--skill` registers the server in the project and still installs the skill in
your home directory.

Every file is inspected before any is written. A second run changes nothing. A
file that differs from what would be written was edited by somebody, and the
command refuses the whole directory until `--force` says otherwise rather than
replacing half of it. Files you keep beside the skill are never removed, and
`--dry-run` names the directory without touching it.

The skill lives in `assets/skill-router-metadata/`; edit it and run
`pnpm generate:skill`.

### Tools

| Tool                   | Takes                     | Returns                                               |
| ---------------------- | ------------------------- | ----------------------------------------------------- |
| `skills_search`        | `task` and optional hints | A ranked shortlist with the reason for each selection |
| `skills_get`           | `id`                      | One skill's content and the references it offers      |
| `skills_get_reference` | `skillId`, `reference`    | One reference document of that skill                  |

`skills_search` takes `task` plus optional `phase`, `stack`, `files`, `keywords` and
`limit`. `stack` mixes languages and frameworks deliberately: a calling agent has no
reason to know which "typescript" is, so every term is matched against both. See
[docs/contracts.md](docs/contracts.md) for the full shapes, limits and error codes.

The tools are registered with underscores rather than dots because tool names reaching
the Anthropic API must match `^[a-zA-Z0-9_-]{1,64}$`.

## Skills

A skill is a `SKILL.md` whose YAML frontmatter says when it is relevant. See
[docs/skill-manifest.md](docs/skill-manifest.md) for the fields, the normalization
rules, the size limits and the reasons a manifest is rejected.

### Skill roots

Skills are discovered under configured roots, one directory per skill:

```text
<root>/<skill-name>/SKILL.md
```

The directory name must match the manifest `name`. That keeps a skill's location
derivable from its identity, which is what lets references be resolved later without
trusting a path taken from the manifest.

With no configuration at all, the roots are the directories the agents themselves
document, so an existing machine works on first run:

```text
global   ~/.claude/skills   ~/.claude/plugins/cache/*/*/*/skills
         ~/.codex/skills    ~/.config/opencode/skills   ~/.agents/skills
project  .claude/skills     .codex/skills   .opencode/skills
         .agents/skills     .skills
```

One of these being absent is not reported — most machines have most of them absent. A
root you write yourself is, because a path you typed and a path this project guessed
are not the same kind of claim. A root may use `*` as a whole path segment, which is how
the plugin cache is reached, since the version sits in the path. Several names for one
directory are scanned once (ADR-0014).

`skill-router.config.example.yaml` documents every setting and its default.

## Ranking

`createSkillRouter` takes a query and returns a short, ordered list, each entry carrying
the reasons it was selected:

```json
{
  "id": "global:angular",
  "score": 0.62,
  "scope": "global",
  "reasons": [
    "phase matched implementation",
    "framework matched angular",
    "file pattern matched **/*.component.ts"
  ]
}
```

`score` runs from 0 to 1 relative to what the query asked for: 1 means "matched
everything the query asked for", not "declared every possible field". Ranking does no
I/O beyond asking the repository for the indexed skills, so it can be tested without a
filesystem. See [docs/ranking.md](docs/ranking.md) for the signals, the scoring formula
and the known limits — including that the weights are still an uncalibrated starting
point.

## Evaluation

Coverage cannot tell you whether the right skills were retrieved. `pnpm eval` runs the
router against four datasets and reports the metrics that can:

| Metric              | Current baseline, 28 cases |
| ------------------- | -------------------------- |
| `Recall@3`          | 0.95                       |
| `Precision@5`       | 0.69                       |
| `MRR`               | 0.97                       |
| `NDCG@5`            | 0.97                       |
| `falsePositiveRate` | 0.31                       |
| `forbiddenRate`     | 0.18                       |

`falsePositiveRate` is the number that matters most here: the project exists to stop
loading irrelevant skills, not to load more of them. One of the four datasets is
deliberately made of skills that declare nothing but a name and a description, which is
what skills written outside this project look like.

There is no absolute gate — twenty-eight cases is not a representative dataset. A run
is compared against `evals/baseline.json`, and any metric moving the wrong way fails
it. See [docs/evaluation.md](docs/evaluation.md), which records what each run found and
the weaknesses it measured.

## Structure

```text
src/
├── domain/          identities, manifests, queries, matches and their errors
├── application/     the three operations and the ports they need
├── router/          filtering, scoring and the reasons a result carries
├── infrastructure/  config, filesystem, manifest parsing, registry
├── adapters/mcp/    the three tools and the stdio server
└── bootstrap/       composition root and the entry point
```

Dependencies point inwards: `domain` ← `application` ← `infrastructure` / `adapters`.
The router never imports the MCP SDK and the MCP adapter never implements ranking.
These boundaries are enforced by `no-restricted-imports` rules in `eslint.config.js`,
so a violation fails lint rather than relying on code review.

## Tooling

| Tool                        | Version                       |
| --------------------------- | ----------------------------- |
| Node.js                     | >= 24 (`.nvmrc` pins 24.20.0) |
| pnpm                        | 11.25.0                       |
| TypeScript                  | 6.0.3                         |
| `@modelcontextprotocol/sdk` | 1.30.0                        |
| Zod                         | 4.6.5                         |
| `yaml` + `picomatch`        | 2.9.1 / 4.0.7                 |
| Jest + ts-jest              | 30.5.1 / 29.4.12              |
| ESLint + typescript-eslint  | 10.10.0 / 8.70.0              |
| Prettier                    | 3.9.6                         |

## Development

`main` is protected: changes go through a pull request that must pass CI, both CodeQL
analyses and the dependency review. See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

Run the built server over stdio:

```bash
pnpm serve
```

## Tests

```bash
pnpm test
pnpm run test:watch
pnpm run test:coverage
```

Retrieval quality is measured separately, since it answers a different question:

```bash
pnpm eval                # score against evals/baseline.json
pnpm run eval:baseline   # accept the current run as the new baseline
```

## Documentation

| Document                                    | Covers                                      |
| ------------------------------------------- | ------------------------------------------- |
| [contracts.md](docs/contracts.md)           | Inputs, outputs, operations and error codes |
| [skill-manifest.md](docs/skill-manifest.md) | Manifest fields, normalization and limits   |
| [ranking.md](docs/ranking.md)               | Signals, scoring and admission              |
| [evaluation.md](docs/evaluation.md)         | How retrieval quality is measured           |
| [adr/](docs/adr/README.md)                  | Why the architecture is the way it is       |

## Security

Skills are data this server reads, never code it runs: no `eval`, no plugins, no shell,
no network. Paths are contained within their roots and symbolic links are refused by
default. Allowing them lets a global root reach a catalog that is linked rather than
copied; a project root stays contained either way.

It does **not** solve prompt injection. A skill is text an agent will read and may act
on, and the server cannot tell guidance from an instruction. Treat a skill directory
like a dependency and review what you install. [SECURITY.md](SECURITY.md) documents the
full trust model, including the limits.

## License

MIT, see [LICENSE](LICENSE).
