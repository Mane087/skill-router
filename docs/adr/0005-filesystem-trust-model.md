# 5. Filesystem trust model

Status: accepted

## Context

The server reads files from directories a user configures, which in practice
means repositories and downloaded catalogs. Reference names arrive from the
calling agent. Both are untrusted input that ends up in a path.

## Decision

Treat every path as hostile and every skill as data.

Containment is checked twice: on the lexical join, which rejects `..` before
the filesystem is touched, and on the resolved real path, which is what catches
a symbolic link pointing outside. Roots are canonicalized once at startup,
since a root may itself be a link.

Symbolic links are refused by default. Nothing read is ever executed: no
`eval`, no `new Function`, no plugins, no shell.

## Consequences

**A skill cannot point outside itself.** Locations come from the registry,
never from a manifest.

**Reference names get two independent defences.** The name must be a plain
kebab-case word, which leaves no way to spell a separator or a traversal
segment, and the resolved path is then contained within the skill's directory.
Either alone would probably be enough; neither alone is worth relying on.

**Path resolution remains check-then-use.** Containment is verified and the
file is then opened. A link swapped between those two steps would defeat the
check. Closing that window needs `O_NOFOLLOW` descriptors, which Node does not
expose portably. Refusing symbolic links by default is the mitigation, not a
fix, and it is documented as such in SECURITY.md rather than left implied.

**Prompt injection is out of scope, explicitly.** A skill is text an agent will
read and may act on. The server returns content faithfully and cannot tell
guidance from an instruction. Pretending otherwise would be worse than saying
so: the honest guidance is to treat a skill directory like a dependency.

**Ranking is not an access boundary.** A skill that ranks poorly is still
readable by identity. Relevance decides what an agent is likely to load, not
what it is allowed to load.
