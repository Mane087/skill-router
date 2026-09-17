# skill-router-mcp

MCP server that discovers, ranks and retrieves agent skills so an agent loads the
smallest sufficient context instead of an entire skill catalog.

> Status: phase 6 (MCP adapter), phase 10 (security CI) and phase 12 (real-agent
> integration). The server exposes the three operations over stdio, has been
> driven end to end by a real client, and has been measured against two skill
> catalogs written by other people — which is what ADR-0011 and ADR-0012 came
> from. Every pull request runs CodeQL and a dependency review.

## Install

Each release carries a self-contained binary per platform. Nothing else is
needed to run it — no Node, no package manager:

```bash
curl -fsSL https://raw.githubusercontent.com/Mane087/skill-router/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/Mane087/skill-router/main/install.ps1 | iex
```

Both resolve the latest release, verify the download against the published
`SHA256SUMS`, and put `skill-router-mcp` on your PATH. Set
`SKILL_ROUTER_VERSION` to a release tag, written exactly as the release shows
it, and `SKILL_ROUTER_INSTALL_DIR` to choose where the binary lands.

| Platform | Architectures |
| -------- | ------------- |
| Linux    | x64, arm64    |
| macOS    | x64, arm64    |
| Windows  | x64           |

Every binary is exercised over real stdio on the system it was built for before
the release gets it, and carries a build provenance attestation you can check:

```bash
gh attestation verify skill-router-mcp-darwin-arm64 --repo Mane087/skill-router
```

## Requirements

Only to work on the project; the released binary needs neither.

- Node.js 24 (see `.nvmrc`)
- pnpm 11

## Development

`main` is protected: changes go through a pull request that must pass CI, both
CodeQL analyses and the dependency review. See
[CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm eval
pnpm build
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

`SKILL_ROUTER_CONFIG` is optional: without it the server scans the directories
the agents themselves use. From a checkout rather than an installed binary, the
command is `node` with `args: ["/path/to/dist/bootstrap/start-stdio.js"]`.

Three tools are exposed, meant to be used in that order:

| Tool                   | Returns                                               |
| ---------------------- | ----------------------------------------------------- |
| `skills_search`        | A ranked shortlist with the reason for each selection |
| `skills_get`           | One skill's full content and the references it offers |
| `skills_get_reference` | One reference document of a skill                     |

That order is the point: the agent narrows from a task to a shortlist, then to
one skill, then to one reference, instead of loading a catalog.

The plan names these `skills.search` and so on. They are registered with
underscores because tool names reaching the Anthropic API must match
`^[a-zA-Z0-9_-]{1,64}$`, which a dot does not.

Configuration is optional; `skill-router.config.example.yaml` documents every
setting and its default.

## Skills

A skill is a `SKILL.md` whose YAML frontmatter says when it is relevant. See
[docs/skill-manifest.md](docs/skill-manifest.md) for the fields, the
normalization rules, the size limits and the reasons a manifest is rejected.

## Skill roots

Skills are discovered under configured roots, one directory per skill:

```text
<root>/<skill-name>/SKILL.md
```

The directory name must match the manifest `name`. That keeps a skill's
location derivable from its identity, which is what lets references be resolved
later without trusting a path taken from the manifest.

Roots are either `global` or `project`, and scope is part of a skill's
identity, so `global:angular` and `project:angular` coexist and a project skill
can never silently shadow a global one. Within a single scope the first root
wins and the shadowed copy is reported.

With no configuration at all, the roots are the directories the agents
themselves document, so an existing machine works on first run:

```text
global   ~/.claude/skills   ~/.claude/plugins/cache/*/*/*/skills
         ~/.codex/skills    ~/.config/opencode/skills   ~/.agents/skills
project  .claude/skills     .codex/skills   .opencode/skills
         .agents/skills     .skills
```

One of these being absent is not reported — most machines have most of them
absent. A root you write yourself is, because a path you typed and a path this
project guessed are not the same kind of claim. A root may use `*` as a whole
path segment, which is how the plugin cache is reached, since the version sits
in the path. Several names for one directory are scanned once (ADR-0014).

A broken skill never fails the scan. It is reported as a diagnostic, and the
remaining skills stay usable.

## Ranking

`createSkillRouter` takes a query and returns a short, ordered list of skills,
each one carrying the reasons it was selected:

```json
{
  "id": "global:angular",
  "score": 0.66,
  "scope": "global",
  "reasons": ["phase matched implementation", "framework matched angular"]
}
```

Ranking is deterministic and does no I/O beyond asking the repository for the
indexed skills, so it can be tested without a filesystem. See
[docs/ranking.md](docs/ranking.md) for the signals, the scoring formula, the
departures from the original plan and the known limits — including that the
weights are still an uncalibrated starting point.

## Evaluation

Coverage cannot tell you whether the right skills were retrieved. `pnpm eval`
runs the router against a dataset and reports recall, precision, MRR, NDCG and —
most importantly for this project — the false positive rate. Runs are compared
against a stored baseline so a ranking change has to be looked at on purpose.
Two catalogs are measured: one using the full metadata schema, one where skills
declare nothing but a name and a description, which is what skills written
outside this project look like. See [docs/evaluation.md](docs/evaluation.md),
which records what each run found and the weaknesses it measured.

## Documentation

| Document                                    | Covers                                      |
| ------------------------------------------- | ------------------------------------------- |
| [contracts.md](docs/contracts.md)           | Inputs, outputs, operations and error codes |
| [skill-manifest.md](docs/skill-manifest.md) | Manifest fields, normalization and limits   |
| [ranking.md](docs/ranking.md)               | Signals, scoring and admission              |
| [evaluation.md](docs/evaluation.md)         | How retrieval quality is measured           |
| [adr/](docs/adr/README.md)                  | Why the architecture is the way it is       |

## Architecture

Dependencies point inwards: `domain` ← `application` ← `infrastructure` / `adapters`.
The router never imports the MCP SDK and the MCP adapter never implements ranking.
These boundaries are enforced by `no-restricted-imports` rules in `eslint.config.js`,
so a violation fails lint rather than relying on code review.

## Security

Skills are data this server reads, never code it runs: no `eval`, no plugins,
no shell, no network. Paths are contained within their roots and symbolic links
are refused by default. Allowing them lets a global root reach a catalog that
is linked rather than copied; a project root stays contained either way.

It does **not** solve prompt injection. A skill is text an agent will read and
may act on, and the server cannot tell guidance from an instruction. Treat a
skill directory like a dependency and review what you install.
[SECURITY.md](SECURITY.md) documents the full trust model, including the limits.

## License

MIT, see [LICENSE](LICENSE).
