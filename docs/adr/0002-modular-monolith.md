# 2. Modular monolith with inward dependencies

Status: accepted

## Context

The selection engine is the product. MCP is one way to reach it, and a CLI will
be another. If the engine knows about its transport, every future transport
drags the previous one along, and ranking becomes untestable without I/O.

Splitting into separate services would buy nothing: there is no independent
scaling story and no second team.

## Decision

One deployable, four layers, dependencies pointing inwards:

```text
domain  ←  application  ←  infrastructure / adapters
```

`domain` holds models and rules and depends on nothing — not the filesystem,
not MCP, not even Zod. `application` depends on ports. `infrastructure` and
`adapters` implement them.

## Consequences

**The boundaries are enforced by lint, not by review.** Four
`no-restricted-imports` rules in `eslint.config.js` fail CI when `domain`
imports a Node built-in, when `router` imports MCP or the filesystem, when
`application` imports concrete infrastructure, or when the MCP adapter reaches
into `router`. A boundary nobody checks is a boundary that erodes.

**Ranking is testable without any I/O.** The router's tests pass a stub of the
repository port; no temporary directory, no MCP server.

**Ports are type-only modules.** They compile to nothing, so V8 coverage reports
them as 0% and they have to be excluded from measurement or they drag the
function threshold down for no reason.

**Validation lives at the edges.** Zod is infrastructure. The domain receives
values that are already normalized, which is why `domain` can forbid importing
it at all.
