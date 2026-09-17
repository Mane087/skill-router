# Skill manifest

A skill is a `SKILL.md` file whose YAML frontmatter describes when the skill is
relevant. Everything the router ranks on comes from this block; the markdown
body is returned only later, by `skills.get`.

```markdown
---
name: angular
description: Angular framework practices for implementing applications.
---

# Angular

Body returned to the agent once it asks for this skill.
```

`name` and `description` are enough. Everything else sharpens the ranking, but
a skill that declares only those two is retrievable: the description is matched
against the task, which is how skills written for other tools work at all. Write
it as the sentence that says _when_ to reach for the skill, not as a title.

## Fields

| Field          | Required | Type             | Purpose                                              |
| -------------- | -------- | ---------------- | ---------------------------------------------------- |
| `name`         | yes      | string           | Identity within a scope. Lowercase kebab-case, ≤ 64. |
| `description`  | yes      | string           | When the skill applies. ≤ 1024 characters. Ranked.   |
| `version`      | no       | positive integer | Manifest revision. Defaults to `1`.                  |
| `tags`         | no       | list of strings  | Free-form keywords. Medium ranking weight.           |
| `phases`       | no       | list of phases   | Lifecycle fit. Highest ranking weight.               |
| `intents`      | no       | list of strings  | Concrete actions, e.g. `create-component`.           |
| `languages`    | no       | list of strings  | Programming languages.                               |
| `frameworks`   | no       | list of strings  | Frameworks, e.g. `angular`.                          |
| `filePatterns` | no       | list of globs    | Matched against the files named in the query.        |
| `related`      | no       | list of strings  | Sibling skills. Contributes a positive boost.        |
| `excludes`     | no       | mapping          | Negative metadata. See below.                        |

`phases` accepts only `planning`, `implementation`, `testing` and `review`. The
set is closed on purpose: phase carries the highest weight in the scoring model,
so a typo such as `implementaion` would silently remove the skill from every
implementation query.

## Negative metadata

`excludes` cuts false positives. A match there is a hard negative in the router,
not a lower score.

```yaml
excludes:
  frameworks:
    - react
    - vue
  intents:
    - backend-only
  languages:
    - python
```

The plan also floated a free-form `doNotUseWhen` list. It is not implemented:
the scoring model has no way to consume free text, and the plan's own rule is
that metadata without a clear use in the router does not get added.

## Normalization

Manifests are normalized before they reach the router, so the same metadata
written differently always ranks the same way:

- Taxonomy terms (`tags`, `phases`, `intents`, `languages`, `frameworks`,
  `related` and every `excludes` list) are trimmed, lowercased, de-duplicated
  and sorted.
- `filePatterns` are trimmed, de-duplicated and sorted, but keep their original
  case: they are matched against real paths.
- `description` has its whitespace collapsed, which removes the line breaks and
  indentation that YAML folded scalars (`>`) introduce.
- Terms that normalize to an empty string are dropped.

Sorting uses the default comparator rather than `localeCompare`, so ordering
does not change with the host locale.

## Limits

Manifests come from user-controlled repositories, so every input is bounded.

| Limit                 | Value           |
| --------------------- | --------------- |
| Skill document        | 256 KB          |
| Frontmatter block     | 16 KB           |
| Description           | 1024 characters |
| Any single term       | 64 characters   |
| File pattern          | 256 characters  |
| Items per list        | 64              |
| Nesting depth         | 8               |
| YAML alias expansions | 100             |

## Unknown fields

A `SKILL.md` is often shared with other tools, which write their own frontmatter
into it: `allowed-tools`, `license` and `metadata` all appear in real
catalogs. Fields this schema does not define are dropped and named in a scan
diagnostic, rather than failing the skill over a key the router never reads.

The diagnostic is what keeps a misspelling visible. `framework` instead of
`frameworks` still drops a ranking signal, and the scan says so on stderr:

```text
skill-router: /path/angular/SKILL.md: Ignored unknown frontmatter fields: framework.
```

`excludes` is the exception and stays strict: nothing outside this project
writes it, so an unknown key inside it is a mistake and not somebody else's
metadata.

## Rejected documents

Validation fails loudly rather than guessing. `InvalidManifestError` carries an
`issues` list naming every field that failed, addressed by dotted path such as
`phases.0`, so an author can fix a manifest in one pass.

A document is rejected when it:

- has no frontmatter block, or one that is not closed;
- contains malformed YAML, or duplicate keys;
- has frontmatter that is not a mapping;
- declares an unknown field inside `excludes`;
- uses a YAML tag the core schema cannot resolve, or one that produces a value
  outside JSON, such as `!!binary` (a `Buffer`) or `!!timestamp` (a `Date`);
- contains a non-finite number, which `.inf` and `.nan` produce;
- exceeds any limit in the table above.
