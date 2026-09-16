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

| Signal      | Weight | Applicable when         | Ratio                                          |
| ----------- | ------ | ----------------------- | ---------------------------------------------- |
| `phase`     | 30     | the query names a phase | 1 if the skill declares it, else 0             |
| `framework` | 25     | the query names a stack | share of stack terms in the skill frameworks   |
| `intent`    | 20     | always                  | share of the skill's intents found in the text |
| `file`      | 15     | the query names files   | share of files matching a pattern              |
| `language`  | 10     | the query names a stack | share of stack terms in the skill languages    |
| `tag`       | 10     | always                  | share of the skill's tags found in the text    |
| `related`   | 5      | always                  | 1 if another candidate declares the skill      |

`stack` mixes languages and frameworks on purpose: a calling agent has no
reason to know which "typescript" is, so every stack term is matched against
both.

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

The candidate set is kept small by dropping anything that scored zero, which
costs nothing: scoring is pure computation over metadata already in memory.

**`related` is a second pass.** A relation only means something once the other
candidates are known, so relations are scored after the first pass. A relation
can lift a relevant skill but never admit an irrelevant one: a skill that
matched nothing on its own never enters the candidate set, so nothing can
vouch it in.

## Known limits

Matching is exact on whole words. There is no stemming, so a task saying "unit
tests" does not match a skill tagged `testing`, and `test` never matches inside
`latest`. Closing that gap is what the plan defers to BM25 and embeddings, once
the evaluation suite shows the deterministic ranking is not enough.

**The weights above are a hypothesis, not a result.** They come from the plan's
starting model and have never been measured against a dataset. The plan is
explicit that calibration is the job of the evaluation suite, and until that
suite exists the ordering between close results should not be trusted. The
reference run in Milestone 1 is not reproduced exactly: this implementation puts
`typescript` ahead of `jest`, because for that query `typescript` matches the
requested phase and language while `jest` matches only a file pattern.
