# Evaluation

Coverage says the code does what it was written to do. It says nothing about
whether the router retrieves the right skills. That is what this suite measures.

```bash
pnpm eval              # run against the stored baseline
pnpm eval:baseline     # record the current run as the new baseline
```

Evaluations run separately from `pnpm test`, under their own Jest config. The
two answer different questions and should fail for different reasons.

## What it runs

Two catalogs, written as real `SKILL.md` files, so a run exercises the whole
pipeline: scanner, registry and router. A catalog must load with no diagnostics
or the run fails.

| Catalog                      | Skills | What it represents                       |
| ---------------------------- | ------ | ---------------------------------------- |
| `evals/skills/`              | 15     | Manifests using the full metadata schema |
| `evals/skills-descriptions/` | 14     | `name` and `description` only            |

The second catalog exists because that is what skills written outside this
project look like. Phase 12 measured the router against two real catalogs and
every skill in them declared nothing but a name and a description. Keeping the
two apart keeps each number attributable: mixed together, a metadata-rich skill
could answer a case meant to measure retrieval from prose.

`evals/datasets/` holds 28 cases across four files, each naming the catalog it
runs against. Each case states the query and two lists:

- `expected` — skills that should come back. Membership is graded, not order.
- `notExpected` — skills that must never come back for this task.

## Metrics

| Metric              | Question it answers                                     |
| ------------------- | ------------------------------------------------------- |
| `Recall@k`          | Of what should have been found, how much was?           |
| `Precision@k`       | Of what came back, how much was wanted?                 |
| `MRR`               | How high did the first correct skill land?              |
| `NDCG@5`            | Was the ordering good, not just the membership?         |
| `falsePositiveRate` | What share of returned skills nobody asked for?         |
| `forbiddenRate`     | What share of cases surfaced an explicitly barred skill |

`Precision@k` divides by how many results actually came back, not by `k`.
Returning two correct skills is a clean answer, not a 40% one — the goal is the
smallest sufficient context, so being conservative must not be punished.

`falsePositiveRate` is the measure that matters most here. The project exists to
stop loading irrelevant skills, not to load more of them.

## Regression gate

A run is compared against `evals/baseline.json`. Any metric that moves the wrong
way beyond a floating-point tolerance fails the run, so a ranking change has to
be looked at deliberately rather than slipping through.

There is **no absolute gate**. The plan sets `Recall@3 >= 90%` as an orienting
target and is explicit that it must not become a gate until the dataset is
representative. Twenty-eight cases is not representative.

## What the first run found

The suite immediately paid for itself. The first measured run:

| Metric         | Before | After |
| -------------- | ------ | ----- |
| Recall@3       | 95.2%  | 92.9% |
| Precision@3    | 52.4%  | 70.2% |
| Precision@5    | 32.9%  | 60.6% |
| False positive | 67.1%  | 39.4% |
| Forbidden      | 71.4%  | 35.7% |

Ten of fourteen cases returned a skill the case explicitly barred. The cause was
that **phase alone admitted a skill**: nearly every skill declares
`implementation`, worth 30 points, which was enough to be retrieved for any
task. A query about Tailwind styling returned `angular`, `jest`, `nestjs` and
`postgres`, all on phase alone.

The fix was to require a match on a signal about the _subject_ — framework,
language, intent, file or tag. Phase and relation reposition a skill that is
already relevant; neither makes one relevant.

Recall fell slightly, and it is worth being precise about what was lost. In
`plan-redesign` the suite stopped returning `ask-questions`, and in
`review-branch` it stopped returning `fp-check`. Both had been retrieved on
phase alone: no word in either task relates to those skills' tags or intents.
**Those hits were accidents, and the recall that measured them was measuring
luck.**

## What Phase 12 found

Running the server against two real catalogs — 21 skills, none of them written
for this project — returned **nothing at all, for every query**. Two independent
causes:

1. Two skills were rejected outright, because their frontmatter carried
   `allowed-tools`, `license` and `metadata`, which the strict schema refused.
2. The other nineteen loaded and could never be retrieved. They declare only
   `name` and `description`, and the admission rule asked for a framework, a
   language, an intent, a file pattern or a tag. The one field every skill
   actually fills was not read by the router at all.

Both are fixed: unknown fields are reported instead of rejected (ADR-0012), and
the description is a ranking signal held to a threshold (ADR-0011). The
`descriptions` dataset exists so this cannot regress silently.

Adding the signal did not cost the metadata datasets anything. `frontend` and
`backend` summaries are unchanged; `generic` improved, with Recall@3 going from
80.0% to 93.3% and NDCG@5 from 83.5% to 94.1% because `plan-redesign` finally
returns all three expected skills instead of one.

### Choosing the threshold

A description is prose, so a single shared word is not evidence the way a shared
tag is. The admission threshold was measured across all four datasets rather
than chosen:

| Threshold | Recall@1 | Precision@5 | NDCG@5 | False pos. | Forbidden |
| --------- | -------- | ----------- | ------ | ---------- | --------- |
| 1/3       | 78.6%    | 66.9%       | 93.3%  | 29.5%      | 17.9%     |
| **1/4**   | 82.1%    | 68.7%       | 96.9%  | 31.3%      | 17.9%     |
| 1/5       | 82.1%    | 58.3%       | 96.9%  | 41.7%      | 21.4%     |

A third loses `debug-failing-test` entirely, by one word. A fifth costs ten
points of precision@5 and starts surfacing barred skills. A quarter improves
every metric but the false positive rate, which it raises by 1.8 points.

## Known weaknesses, measured not guessed

Three causes account for most of the remaining false positive rate:

1. **A shared language admits almost anything.** `playwright`, `react` and
   `angular` are retrieved for backend tasks purely because they declare
   `languages: [typescript]`, as does most of the ecosystem. Language is a much
   weaker signal than its weight implies.

2. **Tags collide lexically.** `tailwind` is retrieved for "**Design** the
   schema and write a migration" because it declares the tag `design`. Matching
   is on whole words with no notion of sense.

3. **Description terms are unweighted.** Every word counts the same, so a word
   half the catalog uses counts as much as one only a single skill uses. On the
   real catalog, "Implement authentication redesign" ties five skills that all
   matched nothing but "implement", and the tie is then broken by identity,
   which is alphabetical order. This is what term weighting — BM25's `idf` — is
   for, and it is the plan's own next step.

None is fixed here. With twenty-eight cases, tuning against them would be
fitting the weights to this dataset rather than to the problem. They are
recorded so the next change is aimed at a measured cause instead of a guess.
