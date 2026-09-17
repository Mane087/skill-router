# 14. The default roots are the directories agents already use

Status: accepted

Replaces the default roots chosen in the plan.

## Context

The default configuration scanned `~/.agent-skills` and `.skills`. Neither is
a directory any agent writes. The plan invented both, and nothing adopted them.

So a server installed and started with no configuration scanned two directories
that do not exist, found nothing, and reported nothing useful. Every user had
to write a configuration file before the product did anything at all, and to
know the layout of their own tools well enough to write it.

The conventions exist and are documented by the tools themselves:

```text
Claude Code  ~/.claude/skills            .claude/skills
Codex CLI    ~/.codex/skills             .codex/skills
OpenCode     ~/.config/opencode/skills   .opencode/skills
```

OpenCode also reads `~/.agents/skills` and `.agents/skills` for
interoperability, which makes those the closest thing to a neutral convention
between agents — and what `~/.agent-skills` was reaching for.

Plugin catalogs are different. A plugin's skills live at
`<marketplace>/<plugin>/<version>/skills` under `~/.claude/plugins/cache`, with
the version in the path, so no fixed string reaches them.

## Decision

Default to the documented directories of all three agents, in both scopes, plus
the plugin cache as a pattern. A root may contain `*` as a whole path segment,
expanded against the filesystem at start-up.

Four consequences of scanning nine roots instead of two had to be settled, and
each was settled against a real machine rather than in the abstract.

**An assumed root that is absent is silent.** A root carries whether the
operator asked for it. One written in a configuration file and missing is a
mistake worth a diagnostic. One this project merely assumes is absent on most
machines, and reporting it would mean seven lines of noise at every start-up,
which teaches people to ignore diagnostics.

**A root is scanned once however many names reach it.** Interoperability
between agents is implemented with links: on the machine this was tested,
`~/.claude/skills`, `~/.config/opencode/skills` and `~/.agents/skills` were all
the same directory. Scanning it three times reported every skill it held as a
duplicate of itself. Roots are compared by canonical path, per scope.

**A pattern keeps the newest copy, quietly.** A plugin cache holds every
version it has downloaded, in directories named by content hash, not version:
one plugin had fifteen. Expansion returns the most recently written first, so
the copy the tool installed last is the one that wins the name, and duplicates
within a pattern are not reported because there is nothing to correct. Sorting
by name instead would have served a copy thirteen days out of date.

**Only a whole segment may be a wildcard.** No `**`, no matching inside a
segment. A pattern that quietly means something narrower than it reads is worse
than one that is refused, so the schema refuses it.

## Consequences

**The product works on first run.** On the test machine, no configuration at
all now finds 22 skills across a linked catalog and two plugins, with 6
diagnostics, all of them about individual skills rather than about the
configuration.

**Expansion depends on the disk, not only on the pattern.** Two machines with
the same pattern and different caches get different roots, and the newest-first
order comes from write times. This is the first thing in the project whose
result a checkout cannot reproduce on its own. It is confined to which copy of
a duplicate wins; ranking stays deterministic given a registry.

**The defaults follow conventions this project does not own.** If an agent
moves its directory, a default becomes a root that does not exist — which is
now silent, so the cost of being wrong is that skills are not found, not that
the server complains. That is the same cost as today's situation, and the
upside is that it works for everybody else.

**`~/.agent-skills` is gone.** Nothing is known to use it. Anyone who does can
name it explicitly, and will get a diagnostic if they misspell it.
