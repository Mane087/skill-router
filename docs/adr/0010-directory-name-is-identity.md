# 10. A skill's directory name is its name

Status: accepted

## Context

A skill lives at `<root>/<directory>/SKILL.md` and its manifest declares a
`name`. Nothing forces the two to agree.

If they may differ, a skill's location stops being derivable from its identity.
Resolving a reference would then need a path looked up from data the skill
itself provides — which is exactly the input that should not be trusted with a
path.

## Decision

The directory name must equal the manifest `name`. A mismatch is reported as a
diagnostic and the skill is not registered.

## Consequences

**References resolve safely.** `skills_get_reference` builds the path from the
registry's record of where the skill was found, combined with a reference name
validated as a plain word. No path ever comes from a manifest.

**Copy-pasted manifests are caught.** Duplicating a skill directory and
forgetting to change the name fails loudly instead of registering a second
skill under the first one's identity.

**Collisions become impossible within a root**, because the filesystem already
guarantees unique directory names. Collisions across roots of the same scope
remain possible and are handled by ADR-0007.

**It constrains how skills are laid out**, which is the cost. A skill cannot
live in a directory named for a category or a version. Given that the
alternative is trusting a manifest with a filesystem path, that is a cheap
constraint.
