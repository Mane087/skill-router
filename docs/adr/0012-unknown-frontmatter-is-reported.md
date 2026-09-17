# 12. Unknown frontmatter fields are reported, not rejected

Status: accepted

Reverses the strictness documented in `docs/skill-manifest.md` for the top level
of a manifest.

## Context

The manifest schema used `z.strictObject` at the top level. The reasoning was
sound in isolation: a misspelled `framework` instead of `frameworks` silently
drops a ranking signal, and a validator that ignores unknown keys hides the
mistake.

Phase 12 pointed the server at two real skill catalogs and two skills were
refused outright:

```text
archify/SKILL.md:           Unrecognized keys: "license", "metadata"
insecure-defaults/SKILL.md: Unrecognized key: "allowed-tools"
```

None of those keys is a typo. A `SKILL.md` is a shared file: the agent runtime
writes `allowed-tools`, a plugin catalog writes `metadata`, and an author writes
`license`. The schema was refusing a whole skill over fields the router does not
read and has no opinion about.

The strictness also failed at its own goal. A refused document is not a legible
error to somebody who never heard of this project — it just means their skill
vanished.

## Decision

Unknown fields at the **top level** are dropped from the parsed manifest and
named in a scan diagnostic:

```text
skill-router: /path/angular/SKILL.md: Ignored unknown frontmatter fields: framework.
```

Diagnostics go to stderr at startup and are never discarded, so a misspelling is
still visible — as a line to read rather than a skill that disappeared.

`excludes` stays strict. Nothing outside this project writes it, so an unknown
key inside it is a mistake and not somebody else's metadata.

## Consequences

Both previously refused skills load, and a catalog shared with other tools works
without its authors knowing this project exists.

**A diagnostic is weaker than a rejection**, and this is a real cost. Somebody
who mistypes `framework` now gets a working skill that ranks worse, plus a line
on stderr they may not read, instead of a failure that stops them. The exchange
is deliberate: the previous behaviour caught that typo by also breaking every
correct manifest that happened to carry a field written by another tool.

**A diagnostic no longer implies a skipped skill.** `SkillScanDiagnostic` used
to mean "this skill could not be loaded", and the stderr line said `skipped`.
Loading one skill can now produce both a result and a diagnostic, so the scanner
returns them separately and the wording was corrected.

**The evaluation catalogs must still load cleanly.** The eval runner fails if a
catalog produces any diagnostic, so an unknown field in an evaluation fixture is
still an error — where the author does know this project exists.
