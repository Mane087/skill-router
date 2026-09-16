# 7. Scope is part of a skill's identity

Status: accepted

## Context

Skills come from two places: a global directory the user maintains, and a
project directory that arrives with a cloned repository. The obvious design is
for the project copy to override the global one by name.

That design has a quiet failure: a repository can replace a skill the user
trusts simply by naming a directory after it, and nothing in the output would
show that a substitution happened.

## Decision

Scope is part of the identity. `global:angular` and `project:angular` are two
different skills that coexist in the index and can both be returned by a
search. There is no implicit override.

## Consequences

**A project skill can never silently shadow a global one.** The result carries
the scope, so a caller can see which one it got and weigh it accordingly.

**Within a single scope, collisions are reported rather than resolved.** When
two roots of the same scope provide the same name, the first root wins and the
shadowed copy is recorded as a diagnostic. The in-memory index refuses
duplicates outright, since by the time a collision reaches it, it is a defect
rather than user input.

**Explicit overrides are not implemented.** The plan asks for them to be
explicit; the simplest honest version of that is "there are none yet". A user
who wants a project skill to win can remove the global one.

**Project skills are less trustworthy by default**, and SECURITY.md says so.
The scope in the result is what makes acting on that distinction possible.
