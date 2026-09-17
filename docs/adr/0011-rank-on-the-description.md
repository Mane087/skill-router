# 11. The description is a ranking signal

Status: accepted

Amends ADR-0009, which defined the subject-match rule this extends.

## Context

Phase 12 pointed the server at two real skill catalogs — 21 skills, none of them
written for this project. It returned **nothing at all, for every query**.

Nineteen of the twenty-one loaded without complaint. They could still never be
retrieved, because they declare `name` and `description` and nothing else, while
ADR-0009 requires a match on a framework, a language, an intent, a file pattern
or a tag. Not one of those fields existed in any of them.

The failure is not in the data. Those skills are written the way skills are
written: a name, and a sentence saying when to reach for the skill. The router
was reading every field except the one that was always there, and the one that
holds precisely the "use this when …" information a router needs.

Two facts made the obvious fix insufficient on its own:

- **Prose does not match exactly.** A description says "use when creating
  components"; the task asks to "create a component". Whole-word matching, which
  the plan's section 12 defers stemming from, finds nothing in either direction.
- **One shared word is not evidence.** A tag is a term an author chose
  deliberately, so one match means something. A description is a sentence, and
  a single word in common between a sentence and a task is a coincidence.

## Decision

Score the description as a ranking signal, weight 15, applicable whenever the
query carries at least one content word.

- The query's stop words and words under three characters are removed first.
- Both sides are reduced to their **Porter stem**, via the `stemmer` package:
  MIT, zero dependencies, 13 KB, an implementation of a published algorithm that
  does not change.
- The ratio is the share of the query's content words found in the description,
  measured against the query like `framework` and `language`, so a long
  description does not outrank a precise one.
- Explanations name the word the caller wrote, not its stem.

Structured metadata is still matched exactly. The asymmetry is the point: a tag
is a chosen term, a description is prose.

A skill is admitted on its description alone only when the description covers at
least **a quarter** of the query's content words. Every other subject signal
still admits on a single match.

## Consequences

The real catalog went from no results for any query to answering all three of
the plan's section 20 scenarios.

The threshold was measured across all four evaluation datasets, not chosen:

| Threshold | Recall@1 | Precision@5 | NDCG@5 | False pos. | Forbidden |
| --------- | -------- | ----------- | ------ | ---------- | --------- |
| 1/3       | 78.6%    | 66.9%       | 93.3%  | 29.5%      | 17.9%     |
| **1/4**   | 82.1%    | 68.7%       | 96.9%  | 31.3%      | 17.9%     |
| 1/5       | 82.1%    | 58.3%       | 96.9%  | 41.7%      | 21.4%     |

A third loses a case entirely, by one word. A fifth costs ten points of
precision@5 and starts surfacing explicitly barred skills. A quarter improves
every metric except the false positive rate, which it raises by 1.8 points.

**The metadata datasets did not pay for it.** `frontend` and `backend` summaries
are unchanged. `generic` improved: Recall@3 from 80.0% to 93.3%, NDCG@5 from
83.5% to 94.1%, because `plan-redesign` now returns all three expected skills
rather than one.

**A dependency was added**, which this project does not do lightly. The
alternative was a hand-written suffix stripper, and the deciding argument was
not size but correctness: a rule set good enough for "create"/"creating" and
"implement"/"implementation" is most of Porter's algorithm, written worse.
Matching on a shared prefix was measured against the same cases and rejected —
"create" is not a prefix of "creating".

**Term weighting is now the largest known gap.** Every word in a description
counts the same, so a word half the catalog uses counts as much as one only a
single skill uses. On the real catalog, "Implement authentication redesign" ties
five skills that matched nothing but "implement", and the tie is broken by
identity, which is alphabetical order. That is what BM25's `idf` is for, and it
is the plan's own next step.

**The evaluation suite grew a second catalog**, `evals/skills-descriptions/`:
fourteen skills declaring only `name` and `description`, and fourteen cases
against them. Without it, this failure would be invisible again the moment the
ranking changes.
