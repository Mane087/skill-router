# 9. Retrieval requires a subject match

Status: accepted, amended by [ADR-0011](0011-rank-on-the-description.md)

Supersedes the hard-filter design sketched in the plan's section 5.

ADR-0011 adds the description to the list of subject signals, under a threshold.
Without it this rule was unsatisfiable for any skill written outside this
project, which is most of them.

## Context

The plan lists `phase-filter.ts` and `framework-filter.ts` as hard filters.
Applying either as an exclusion contradicts the plan's own Milestone 1: with
`phase: implementation`, a hard phase filter drops a skill that declares only
`testing`, yet the milestone expects `jest` in second place.

So phase and framework were made scoring signals, and any skill scoring above
zero became a candidate. Then the evaluation suite measured what that produced:

| Metric                    | Value            |
| ------------------------- | ---------------- |
| False positive rate       | 67.1%            |
| Cases with a barred skill | 71.4% (10 of 14) |
| Precision@5               | 32.9%            |

A query about Tailwind styling returned `angular`, `jest`, `nestjs` and
`postgres`. All four matched on phase alone.

## Decision

Scoring above zero is not enough. A candidate must match at least one signal
about the **subject** of the task: framework, language, intent, file pattern or
tag.

Phase and relation are excluded from that list. Phase is context, not subject —
nearly every skill declares `implementation`, worth 30 points, so matching it
proves nothing about the topic. A relation only says another skill vouches for
this one.

## Consequences

| Metric                    | Before | After |
| ------------------------- | ------ | ----- |
| False positive rate       | 67.1%  | 39.4% |
| Cases with a barred skill | 71.4%  | 35.7% |
| Precision@5               | 32.9%  | 60.6% |
| Recall@3                  | 95.2%  | 92.9% |

**Recall fell, and what it lost was luck.** Two hits disappeared:
`ask-questions` in `plan-redesign` and `fp-check` in `review-branch`. Both had
been retrieved on phase alone — no word in either task relates to those skills'
tags or intents. The recall measuring them was measuring coincidence.

**No weight was changed to achieve this.** The rule is about what makes a skill
relevant, not about how much a signal is worth. That is why it was acceptable
to apply it against a fourteen-case dataset, where tuning weights would not
have been.

**Two causes of the remaining 39% are measured, not guessed**, and deliberately
left alone: a shared `language` admits almost anything, since most of the
ecosystem is TypeScript, and tags collide lexically — `tailwind` is retrieved
for "Design the schema" because it declares the tag `design`.
