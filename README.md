# skill-router-mcp

MCP server that discovers, ranks and retrieves agent skills so an agent loads the
smallest sufficient context instead of an entire skill catalog.

> Status: phase 5 (evaluation). Ranking is measured against a dataset with a
> regression baseline. The MCP server answers the `initialize` handshake but
> does not expose the routing tools yet: that is phase 6.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 11

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm eval
pnpm build
```

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
See [docs/evaluation.md](docs/evaluation.md), which also records what the first
run found and the weaknesses it measured.

## Architecture

Dependencies point inwards: `domain` ← `application` ← `infrastructure` / `adapters`.
The router never imports the MCP SDK and the MCP adapter never implements ranking.
These boundaries are enforced by `no-restricted-imports` rules in `eslint.config.js`,
so a violation fails lint rather than relying on code review.

## License

MIT
