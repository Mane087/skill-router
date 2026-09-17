# Ranking

The router turns a query into a short, ordered list of skills, each one able to
say why it is there. It is deterministic and does no I/O beyond asking the
repository for the indexed skills.

## Pipeline

```text
query
  ↓
exclusions        skills whose negative metadata matches are removed outright
  ↓
scoring           every remaining skill is scored on its own metadata
  ↓
candidates        skills that matched nothing are dropped
  ↓
relations         candidates that others declare as related are lifted
  ↓
ranking           sorted by score, ties broken by identity
  ↓
top K
```

## Signals

| Signal        | Weight | Applicable when             | Ratio                                          |
| ------------- | ------ | --------------------------- | ---------------------------------------------- |
| `phase`       | 30     | the query names a phase     | 1 if the skill declares it, else 0             |
| `framework`   | 25     | the query names a stack     | share of stack terms in the skill frameworks   |
| `intent`      | 20     | always                      | share of the skill's intents found in the text |
| `file`        | 15     | the query names files       | share of files matching a pattern              |
| `language`    | 10     | the query names a stack     | share of stack terms in the skill languages    |
| `tag`         | 10     | always                      | share of the skill's tags found in the text    |
| `description` | 15     | the query has content words | share of query terms found in the description  |
| `related`     | 5      | always                      | 1 if another candidate declares the skill      |

`stack` mixes languages and frameworks on purpose: a calling agent has no
reason to know which "typescript" is, so every stack term is matched against
both.

### Free text

`description` is the only signal that matches prose against prose, and it is
matched differently from the rest:

- the query's stop words are removed first, along with words shorter than three
  characters, or every description would match any task containing "the";
- both sides are reduced to their Porter stem, so a skill that says "use when
  creating components" answers a task that asks to "create a component";
- the explanation names the word the caller wrote, never its stem.

Structured metadata is still matched exactly. A tag or an intent is a term an
author chose deliberately; a description is prose, and two people describing the
same thing rarely inflect it the same way (ADR-0011).

## Score

```text
score = Σ (weight × ratio) / Σ weight        over applicable signals only
```

The result lies between 0 and 1. Whether a signal is applicable depends on the
**query**, never on the skill: if it varied per skill, each score would be
normalized against a different total and results would stop being comparable
within one search.

So a score of 1 means "matched everything the query asked for", not "declared
every possible field". A skill that declares no intents simply earns nothing on
that signal.

Ratios are measured against the query, or against the skill's own list for
`intent` and `tag`. A skill listing twenty frameworks does not outrank one
listing the single framework the task actually uses.

Ties are broken by identity, so equal scores keep a stable order across runs.

## Two deliberate departures from the plan

**Phase and framework are not hard filters.** The plan's section 5 lists
`phase-filter.ts` and `framework-filter.ts`, but applying either as an exclusion
contradicts the plan's own Milestone 1: with `phase: implementation` and
`stack: [angular, typescript]`, a hard phase filter drops a testing skill and a
hard framework filter drops `jest`, yet the milestone expects `jest` in second
place. Phase and framework therefore decide score, not membership.

The only hard filter is `excludes`. A skill matching a negative rule is removed
rather than ranked low, because a low score would still let it win a query with
few candidates.

## Admission

Scoring above zero is not enough to be retrieved. A candidate must match at
least one signal about the **subject** of the task: framework, language, intent,
file or tag — or cover at least a quarter of the query's content words in its
description.

Phase and relation are deliberately excluded from that list. Phase is context,
not subject — nearly every skill declares `implementation`, so matching it says
nothing about the topic. A relation only says that some other skill vouches for
this one. Both reposition a skill that is already relevant; neither makes one
relevant.

The description is held to a threshold while every other subject signal is
admitted on a single match. The difference is deliberate: one shared tag is a
term somebody chose, while one shared word of prose is a coincidence, and
admitting on it retrieves the whole catalog.

A quarter is measured, not chosen. Against the four datasets, a third loses a
case entirely; a fifth costs ten points of precision@5 and raises the forbidden
rate; a quarter improves every metric but the false positive rate, which it
raises by under two points.

This rule is not a guess. The first evaluation run measured a 67% false positive
rate, with ten of fourteen cases returning an explicitly barred skill, because
phase alone was admitting every skill to every task. Requiring a subject match
cut false positives to 39% and forbidden results to 36%. See
[evaluation.md](evaluation.md).

The description was added to the list for the opposite reason. Without it the
rule was unsatisfiable for any skill written outside this project: measured
against two real catalogs, twenty-one skills declaring only `name` and
`description` produced no result for any query at all (ADR-0011).

**`related` is a second pass.** A relation only means something once the other
candidates are known, so relations are scored after the first pass. A relation
can lift a relevant skill but never admit an irrelevant one: a skill that
matched nothing on its own never enters the candidate set, so nothing can
vouch it in.

## Known limits

Structured metadata is matched exactly on whole words. A task saying "unit
tests" does not match a skill tagged `testing`, and `test` never matches inside
`latest`. Only the description is stemmed. Closing the rest of that gap is what
the plan defers to BM25 and embeddings, once the evaluation suite shows the
deterministic ranking is not enough.

**Every term in a description counts the same.** There is no term weighting, so
a word that half the catalog uses counts as much as one only a single skill
uses. A short query made of common words therefore produces a group of skills
tied at the same score, ordered by identity rather than by relevance: "Implement
authentication redesign" ties five skills that all matched nothing but
"implement". Term weighting is the same deferral as above.

**The weights above are still uncalibrated.** They come from the plan's starting
model. The evaluation suite now measures them, but twenty-eight cases is not
enough to tune against without fitting the weights to that dataset, so they are
unchanged. The ordering between close results should not be trusted yet.

Two weaknesses are measured rather than suspected: a shared `language` admits
almost any skill, since most of the ecosystem is TypeScript, and tags collide
lexically — `tailwind` is retrieved for "Design the schema" because it declares
the tag `design`. Both are recorded in [evaluation.md](evaluation.md).

Milestone 1's reference ordering is not reproduced exactly: this implementation
puts `typescript` ahead of `jest`, because for that query `typescript` matches
the requested phase and language while `jest` matches only a file pattern.
