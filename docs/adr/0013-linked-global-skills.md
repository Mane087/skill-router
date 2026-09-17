# 13. A global root may follow a link out of itself

Status: accepted

Qualifies the symlink policy recorded in ADR-0005.

## Context

`security.followSymlinks` was documented as the switch an operator turns on for
roots they control. It did not do that.

Containment was checked on the resolved real path under every policy, so the
option only ever admitted a link whose target already sat inside the same root.
That is the case with the least reason to exist. The layout it refused is the
ordinary one: a person keeps one catalog of skills and links it into the
directory each tool reads.

Phase 12 found it against a real machine. Three skills linked from a shared
workspace into a configured root were excluded with the option off and excluded
with it on, only with a different reason:

```text
followSymlinks: false → Path is reached through a symbolic link: mastering-typescript/SKILL.md
followSymlinks: true  → Path resolves outside the skill root: mastering-typescript/SKILL.md
```

The agent runtime reading the same directory loads them. The router did not.

## Decision

When `followSymlinks` is on, a link in a **global** root may resolve outside
that root. A project root never follows a link out of itself, whatever the
option says.

The asymmetry is the one ADR-0007 already draws. A global root is a directory
the operator chose and maintains. A project root arrives with a checkout: its
links are written by whoever wrote the repository, and a cloned
`.skills/x/SKILL.md -> ~/.aws/credentials` would otherwise be read and returned
to an agent as if it were a skill.

A skill reached through a link is anchored at the link's target: its directory
is taken from the resolved `SKILL.md`, not from the root and the directory
name. Everything inside it is then contained there under the strict policy.

## Consequences

**The option now describes what it does.** It is still off by default, and
turning it on is still a statement about a directory the operator trusts.

**A skill still cannot point outside itself.** The waiver applies to the link
that reaches a skill, never to a reference within one. `references/x.md`
resolves inside the skill's real directory or it is refused, so ADR-0005 holds
where it matters: the part of the path an agent can influence.

**A traversal is refused under every policy.** The lexical check runs first and
is not waivable. Only a link already on disk can leave a root, never a `..`
written into a request.

**The check-then-use window widens for a global root.** A link swapped between
the containment check and the read now has a larger target set. Refusing links
remains the default and remains the mitigation, as SECURITY.md says.

**One flag still covers every global root.** An operator who trusts one catalog
and not another cannot say so. Per-root policy was considered and deferred: it
turns `roots` from a list of strings into a list of strings or objects, and
nothing yet needs that precision.
