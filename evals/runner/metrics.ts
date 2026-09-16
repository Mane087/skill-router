/**
 * Retrieval metrics for the evaluation suite.
 *
 * Every function takes the skill names the router returned, in rank order, and
 * the names the case expects. Relevance is binary: a skill is either expected
 * or it is not.
 */

function topK(returned: readonly string[], k: number): readonly string[] {
  return returned.slice(0, k)
}

function hits(returned: readonly string[], expected: readonly string[], k: number): number {
  return topK(returned, k).filter((name) => expected.includes(name)).length
}

/** Share of the expected skills that appear within the cut-off. */
export function recallAt(
  returned: readonly string[],
  expected: readonly string[],
  k: number,
): number {
  if (expected.length === 0) {
    return 0
  }

  return hits(returned, expected, k) / expected.length
}

/**
 * Share of the returned skills that were expected.
 *
 * Divided by how many results actually came back rather than by `k`. The goal
 * of this project is to return the smallest sufficient set, so answering with
 * two correct skills is a clean answer, not a 40% one.
 */
export function precisionAt(
  returned: readonly string[],
  expected: readonly string[],
  k: number,
): number {
  const considered = topK(returned, k)

  if (considered.length === 0) {
    return 0
  }

  return hits(returned, expected, k) / considered.length
}

/** Reciprocal of the rank of the first expected skill. */
export function reciprocalRank(returned: readonly string[], expected: readonly string[]): number {
  const index = returned.findIndex((name) => expected.includes(name))

  return index === -1 ? 0 : 1 / (index + 1)
}

/**
 * Normalized discounted cumulative gain.
 *
 * Unlike recall, this one cares where a hit landed: a skill found in first
 * place counts for more than the same skill found in fifth.
 */
export function ndcgAt(
  returned: readonly string[],
  expected: readonly string[],
  k: number,
): number {
  if (expected.length === 0) {
    return 0
  }

  const gain = topK(returned, k).reduce(
    (sum, name, index) => (expected.includes(name) ? sum + discount(index) : sum),
    0,
  )

  const ideal = Array.from({ length: Math.min(k, expected.length) }, (_unused, index) =>
    discount(index),
  ).reduce((sum, value) => sum + value, 0)

  return ideal === 0 ? 0 : gain / ideal
}

function discount(index: number): number {
  return 1 / Math.log2(index + 2)
}

/** How many skills that must never appear did appear. */
export function countForbidden(
  returned: readonly string[],
  notExpected: readonly string[],
  k: number,
): number {
  return topK(returned, k).filter((name) => notExpected.includes(name)).length
}

/**
 * Share of returned skills nobody asked for.
 *
 * The plan calls this the most important measure of the project: the point is
 * not to surface more knowledge but to stop surfacing irrelevant knowledge.
 */
export function falsePositiveRate(
  returned: readonly string[],
  expected: readonly string[],
  k: number,
): number {
  const considered = topK(returned, k)

  if (considered.length === 0) {
    return 0
  }

  return considered.filter((name) => !expected.includes(name)).length / considered.length
}
