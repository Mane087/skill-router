# Contracts

What goes in, what comes out, and what happens when something is wrong. The
shapes below are the domain contracts; the MCP tools are a thin rendering of
them.

## SkillQuery

A search request, after validation and normalization.

| Field      | Required | Meaning                                             |
| ---------- | -------- | --------------------------------------------------- |
| `task`     | yes      | What the agent is about to do, in its own words     |
| `phase`    | no       | `planning`, `implementation`, `testing` or `review` |
| `stack`    | no       | Languages and frameworks, mixed, in any order       |
| `files`    | no       | Paths the task touches                              |
| `keywords` | no       | Extra terms not present in the task                 |
| `limit`    | no       | Results wanted; defaults to 5, capped at 10         |

`stack` mixes languages and frameworks deliberately: a calling agent has no
reason to know which "typescript" is, so every term is matched against both.

Normalization mirrors the manifest rules, so a query and a manifest written in
different cases still match. Terms are trimmed, lowercased, de-duplicated and
sorted; `files` keep their case because they are matched against glob patterns.
Terms that normalize to an empty string are dropped.

A limit above the maximum is capped rather than rejected — asking for more
results than the server returns is reasonable. A limit of zero or a fraction is
rejected, because it is not.

Bounds: task 4096 characters, any entry 256 characters, any collection 64
entries.

## SkillMatch

One ranked result.

```json
{
  "id": "global:angular",
  "scope": "global",
  "score": 0.62,
  "reasons": [
    "phase matched implementation",
    "framework matched angular",
    "file pattern matched **/*.component.ts"
  ]
}
```

`score` runs from 0 to 1, relative to what the query asked for: 1 means
"matched everything the query asked for", not "declared every possible field".
See [ranking.md](ranking.md) for how it is computed.

`reasons` is never empty. A ranked result always explains itself, and only
signals that actually contributed are listed.

`scope` repeats what `id` already carries, because a caller weighing a project
skill differently from a global one should not have to parse an identifier to
find that out.

Results are ordered by descending score, ties broken by identity so the order
is reproducible.

## Identity

`<scope>:<name>`, where scope is `global` or `project` and name is lowercase
kebab-case, at most 64 characters.

Scope is part of the identity: `global:angular` and `project:angular` are
different skills. The narrow name shape is not cosmetic — it rules out path
separators and traversal segments before any path is built (ADR-0007,
ADR-0010).

## Operations

Three, meant to be used in that order. Each narrows the context further.

### `skills_search`

Takes a `SkillQuery`, returns `{ skills: SkillMatch[] }`. Returns metadata and
reasons only, never skill content. An empty list is a valid answer.

### `skills_get`

Takes `{ id }`, returns the skill's name, description, markdown body and the
names of the references it offers.

### `skills_get_reference`

Takes `{ skillId, reference }`, returns that one reference document. The
reference name must be one that `skills_get` listed: a plain kebab-case word
with no extension and no path.

## Errors

Every expected failure carries a stable `code`, so a caller never has to match
on message text. Over MCP they arrive as an error result whose text begins with
that code.

| Code                  | Means                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `INVALID_SKILL_QUERY` | The search request cannot be satisfied as written                                               |
| `INVALID_SKILL_ID`    | The identity is malformed                                                                       |
| `SKILL_NOT_FOUND`     | No skill is registered under that identity                                                      |
| `REFERENCE_NOT_FOUND` | The skill exists but offers no such reference                                                   |
| `UNSAFE_PATH`         | A path escapes its root, violates the symlink policy, or the reference name is not a plain word |
| `INVALID_MANIFEST`    | A `SKILL.md` cannot be parsed or validated                                                      |
| `INVALID_CONFIG`      | Configuration exists but cannot be used                                                         |
| `DUPLICATE_SKILL`     | Two skills resolved to the same identity                                                        |

`INVALID_MANIFEST` carries an `issues` list naming every field that failed,
addressed by dotted path such as `phases.0`, so an author can fix a manifest in
one pass rather than one error at a time.

### What is an error and what is not

A broken skill, an unreadable root or a duplicate across roots does **not** fail
a scan. Each is reported as a diagnostic and the remaining skills stay usable:
someone whose global directory is missing should still get their project
skills. Diagnostics are written to stderr at startup, never discarded.

An unexpected failure is never converted into a normal-looking answer. Only
known domain errors become error results; anything else propagates, because a
bug reported as "no results" is worse than a bug that surfaces.

`UNSAFE_PATH` is deliberately not split into "not found" and "refused" at the
filesystem layer. A missing reference is distinguished from a rejected one only
where that distinction is safe to make, so probing for the existence of files
outside a root gets the same answer either way.
