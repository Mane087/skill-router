# Architecture decisions

One file per decision: the context that forced it, what was decided, and what
followed. A decision that turned out wrong stays here with what replaced it,
because the reasoning is the point.

| ADR                                             | Decision                                      |
| ----------------------------------------------- | --------------------------------------------- |
| [0001](0001-typescript-and-node.md)             | TypeScript on Node, strict, ESM               |
| [0002](0002-modular-monolith.md)                | Modular monolith with inward dependencies     |
| [0003](0003-mcp-as-adapter.md)                  | MCP is an adapter, not the engine             |
| [0004](0004-deterministic-ranking-first.md)     | Deterministic ranking before embeddings       |
| [0005](0005-filesystem-trust-model.md)          | Filesystem trust model                        |
| [0006](0006-no-remote-skill-loading.md)         | No remote skill loading in v1                 |
| [0007](0007-explicit-scopes.md)                 | Scope is part of a skill's identity           |
| [0008](0008-jest-over-vitest.md)                | Jest rather than Vitest                       |
| [0009](0009-subject-match-required.md)          | Retrieval requires a subject match            |
| [0010](0010-directory-name-is-identity.md)      | A skill's directory name is its name          |
| [0011](0011-rank-on-the-description.md)         | The description is a ranking signal           |
| [0012](0012-unknown-frontmatter-is-reported.md) | Unknown frontmatter is reported, not rejected |
| [0013](0013-linked-global-skills.md)            | A global root may follow a link out of itself |
| [0014](0014-known-skill-roots.md)               | Default roots are the agents' own directories |

## A note on timing

The plan places these before implementation. They were written after phases 1
to 6 and 10 were built, so they are retrospective.

That costs something and buys something. It costs the discipline of settling a
question before the code makes it awkward to revisit. It buys consequences that
were observed rather than predicted: ADR-0004 and ADR-0009 record numbers from
an evaluation run, ADR-0001 records a version constraint discovered by an
install failing, and ADR-0011 and ADR-0012 exist only because the server was
pointed at skills somebody else had written.

Where a decision departs from the plan, the ADR says so and why.
