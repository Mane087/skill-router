# 4. Deterministic ranking before embeddings

Status: accepted

## Context

The obvious way to rank skills is to embed them. It is also the way that makes
the system impossible to explain, impossible to reproduce, and dependent on a
model provider for its core function.

The plan's position is that embeddings must be an evidence-based improvement,
not a starting assumption. Nothing had been measured, so there was no evidence.

## Decision

Rank on declared metadata and exact lexical matching. Every result explains
itself. Ranking is pure computation: same inputs, same output, on any machine.

Build the evaluation suite before tuning anything.

## Consequences

**Sorting never uses `localeCompare`.** Locale-dependent ordering would make
results differ between machines, which is not a ranking system anyone can
debug.

**There is no stemming.** A task saying "unit tests" does not match a skill
tagged `testing`. This is a real miss, and it is the clearest argument for the
BM25 or embedding work the plan defers to v2 — but now it is an argument backed
by a measurement rather than an intuition.

**Weights are still uncalibrated.** They come from the plan's starting model
and have never been fitted to data. Fourteen evaluation cases is not enough to
tune against without fitting the weights to that dataset instead of to the
problem, so they stay as they are.

**Milestone 1's reference ordering is not reproduced.** The plan expects
`angular, jest, typescript`; the implementation returns `angular, typescript,
jest`, because for that query `typescript` matches the requested phase and
language while `jest` matches only a file pattern. The milestone was
illustrative, and forcing the weights to reproduce it would have been fitting
the system to an example.

**Measuring came first, and it was worth it.** See ADR-0009.
