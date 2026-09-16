# 6. No remote skill loading in v1

Status: accepted

## Context

A registry of installable skills is an obvious feature. It is also a supply
chain, an authentication story, a caching story, and a much larger attack
surface — all before the core question, whether the router picks the right
skill, has been answered.

## Decision

No network access of any kind in v1. Skills are read from the local filesystem
only. No remote registries, no automatic installation, no telemetry.

## Consequences

**The threat model stays small enough to state.** Everything the server reads
is already on the user's disk, put there by the user. There is no fetched
content, no credential to leak and no endpoint to trust.

**Distribution is someone else's problem, for now.** Users clone repositories
or copy directories. That is a real limitation, and it is the right one to
accept while the ranking is still being calibrated.

**The transport decision stays open.** With no network in the server itself,
adding an HTTP transport later is an adapter, not a rewrite.
