import type { DatasetReport, EvaluationSummary } from './evaluate.js'

export interface EvaluationReport {
  readonly datasets: readonly DatasetReport[]
  readonly summary: EvaluationSummary
}

/** Metrics where a higher number is better. `falsePositiveRate` is not one. */
const HIGHER_IS_BETTER = [
  'recallAt1',
  'recallAt3',
  'recallAt5',
  'precisionAt3',
  'precisionAt5',
  'mrr',
  'ndcgAt5',
] as const

export interface Regression {
  readonly metric: string
  readonly baseline: number
  readonly current: number
}

/**
 * Compares a run against a stored baseline.
 *
 * The tolerance absorbs floating point noise, not real movement: anything
 * beyond it is reported so a ranking change has to be looked at on purpose.
 */
export function findRegressions(
  baseline: EvaluationSummary,
  current: EvaluationSummary,
  tolerance = 0.001,
): readonly Regression[] {
  const regressions: Regression[] = []

  for (const metric of HIGHER_IS_BETTER) {
    if (current[metric] < baseline[metric] - tolerance) {
      regressions.push({ metric, baseline: baseline[metric], current: current[metric] })
    }
  }

  for (const metric of ['falsePositiveRate', 'forbiddenRate'] as const) {
    if (current[metric] > baseline[metric] + tolerance) {
      regressions.push({ metric, baseline: baseline[metric], current: current[metric] })
    }
  }

  return regressions
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1).padStart(5)}%`
}

export function formatSummary(label: string, summary: EvaluationSummary): string {
  return [
    `${label} (${String(summary.cases)} cases)`,
    `  Recall@1    ${percent(summary.recallAt1)}`,
    `  Recall@3    ${percent(summary.recallAt3)}`,
    `  Recall@5    ${percent(summary.recallAt5)}`,
    `  Precision@3 ${percent(summary.precisionAt3)}`,
    `  Precision@5 ${percent(summary.precisionAt5)}`,
    `  MRR         ${percent(summary.mrr)}`,
    `  NDCG@5      ${percent(summary.ndcgAt5)}`,
    `  False pos.  ${percent(summary.falsePositiveRate)}`,
    `  Forbidden   ${percent(summary.forbiddenRate)}`,
  ].join('\n')
}

/** Per-case detail, so a bad number can be traced to the case that caused it. */
export function formatCases(report: DatasetReport): string {
  return report.outcomes
    .map((outcome) => {
      const flag = outcome.forbidden > 0 ? ' [forbidden]' : ''

      return `  ${outcome.id.padEnd(22)} ${outcome.returned.join(', ') || '(nothing)'}${flag}`
    })
    .join('\n')
}
