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

`evals/skills/` holds a catalog of 15 skills written as real `SKILL.md` files,
so a run exercises the whole pipeline: scanner, registry and router. The catalog
must load with no diagnostics or the run fails.

`evals/datasets/` holds 14 cases across three files. Each case states the query
and two lists:

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
representative. Fourteen cases is not representative.

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

## Known weaknesses, measured not guessed

Two causes account for most of the remaining 39% false positive rate:

1. **A shared language admits almost anything.** `playwright`, `react` and
   `angular` are retrieved for backend tasks purely because they declare
   `languages: [typescript]`, as does most of the ecosystem. Language is a much
   weaker signal than its weight implies.

2. **Tags collide lexically.** `tailwind` is retrieved for "**Design** the
   schema and write a migration" because it declares the tag `design`. Matching
   is on whole words with no notion of sense.

Neither is fixed here. With fourteen cases, tuning against them would be fitting
the weights to this dataset rather than to the problem. They are recorded so the
next change is aimed at a measured cause instead of a guess.
