import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildSkillRegistry } from '../src/infrastructure/registry/registry-builder.js'
import { createSkillRouter } from '../src/router/skill-router.js'
import { evaluateDataset, summarize } from './runner/evaluate.js'
import { parseDataset } from './runner/dataset-schema.js'
import { findRegressions, formatCases, formatSummary } from './runner/report.js'
import type { CaseOutcome, DatasetReport } from './runner/evaluate.js'
import type { EvaluationReport } from './runner/report.js'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DATASETS = ['frontend', 'backend', 'generic']
const BASELINE = join(ROOT, 'baseline.json')

async function loadReport(): Promise<EvaluationReport> {
  const registry = await buildSkillRegistry({
    roots: { global: [join(ROOT, 'skills')], project: [] },
    policy: { followSymlinks: false },
    limits: { maxSkills: 200 },
  })

  if (registry.diagnostics.length > 0) {
    throw new Error(
      `The evaluation catalog must load cleanly. ${registry.diagnostics
        .map((diagnostic) => `${diagnostic.path}: ${diagnostic.reason}`)
        .join('; ')}`,
    )
  }

  const router = createSkillRouter(registry.repository)
  const datasets: DatasetReport[] = []

  for (const name of DATASETS) {
    const source = join(ROOT, 'datasets', `${name}.json`)
    const parsed: unknown = JSON.parse(await readFile(source, 'utf8'))

    datasets.push(await evaluateDataset(router, parseDataset(parsed, source)))
  }

  const everyOutcome = datasets.flatMap<CaseOutcome>((dataset) => [...dataset.outcomes])

  return { datasets, summary: summarize(everyOutcome) }
}

let report: EvaluationReport

beforeAll(async () => {
  report = await loadReport()

  await mkdir(join(ROOT, 'reports'), { recursive: true })
  await writeFile(join(ROOT, 'reports', 'latest.json'), `${JSON.stringify(report, null, 2)}\n`)

  const lines = [
    '',
    ...report.datasets.flatMap((dataset) => [
      formatSummary(dataset.name, dataset.summary),
      formatCases(dataset),
      '',
    ]),
    formatSummary('OVERALL', report.summary),
    '',
  ]

  console.log(lines.join('\n'))
}, 30_000)

describe('evaluation run', () => {
  it('evaluates every case in every dataset', () => {
    expect(report.summary.cases).toBe(
      report.datasets.reduce((sum, dataset) => sum + dataset.outcomes.length, 0),
    )
  })

  it('returns at least one skill for every case', () => {
    const empty = report.datasets
      .flatMap((dataset) => dataset.outcomes)
      .filter((outcome) => outcome.returned.length === 0)
      .map((outcome) => outcome.id)

    expect(empty).toEqual([])
  })
})

describe('regression against the stored baseline', () => {
  it('does not score worse than the recorded run', async () => {
    let baseline: EvaluationReport

    try {
      baseline = JSON.parse(await readFile(BASELINE, 'utf8')) as EvaluationReport
    } catch {
      console.log(`No baseline yet. Write one with: pnpm eval:baseline`)
      return
    }

    const regressions = findRegressions(baseline.summary, report.summary)

    expect(
      regressions.map(
        (regression) =>
          `${regression.metric}: ${regression.baseline.toFixed(3)} -> ${regression.current.toFixed(3)}`,
      ),
    ).toEqual([])
  })
})
