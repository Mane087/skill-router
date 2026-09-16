# 3. MCP is an adapter, not the engine

Status: accepted

## Context

Claude Code, Codex and OpenCode all speak MCP, but a CLI is planned and the
protocol will keep moving. If business rules live in tool handlers, every
client and every protocol revision rewrites them.

## Decision

The MCP adapter maps transport to use case and does nothing else. No filtering,
no scoring, no filesystem access. A tool handler builds the input, calls the use
case, and renders the result.

`bootstrap/container.ts` is the only module that knows about every layer at
once.

## Consequences

**Tools are named with underscores, departing from the plan.** The plan calls
them `skills.search`, `skills.get` and `skills.get_reference`. A tool name that
reaches the Anthropic API must match `^[a-zA-Z0-9_-]{1,64}$`, and Claude Code
exposes MCP tools as `mcp__<server>__<tool>`, so a dot would break at the
client. The SDK does **not** validate names, so the dotted form would have
passed server-side and failed where it mattered. They are registered as
`skills_search`, `skills_get` and `skills_get_reference`.

**Error semantics are part of the adapter.** Expected domain failures become
error results carrying their `code`, so a client can tell "no such skill" from
"the server broke". Anything else propagates: a bug must not be dressed up as
a normal answer.

**The SDK's own result type has to be used.** A hand-written result interface
fails to typecheck, because the spec allows extra fields and the SDK types the
payload as an open record.

**Argument validation is the SDK's, and it does not throw.** An invalid call
comes back as an error result describing the failure, not as a rejected
promise. Contract tests assert that behaviour rather than an assumed one.
