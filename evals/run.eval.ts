import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildSkillRegistry } from '../src/infrastructure/registry/registry-builder.js'
import { createSkillRouter } from '../src/router/skill-router.js'
import { evaluateDataset, summarize } from './runner/evaluate.js'
import { parseDataset } from './runner/dataset-schema.js'
import { findRegressions, formatCases, formatSummary } from './runner/report.js'
import type { CaseOutcome, DatasetReport } from './runner/evaluate.js'
import type { SkillRouter } from '../src/router/skill-router.js'
import type { EvaluationReport } from './runner/report.js'

const ROOT = dirname(fileURLToPath(import.meta.url))

/**
 * Each dataset names the catalog it is measured against.
 *
 * `skills` carries the full metadata the manifest supports. `skills-descriptions`
 * carries `name` and `description` and nothing else, which is what every skill
 * in the two catalogs Phase 12 measured actually looks like. Keeping them apart
 * keeps each number attributable: mixing them would let a metadata-rich skill
 * answer a case meant to measure retrieval from prose.
 */
const DATASETS = [
  { name: 'frontend', catalog: 'skills' },
  { name: 'backend', catalog: 'skills' },
  { name: 'generic', catalog: 'skills' },
  { name: 'descriptions', catalog: 'skills-descriptions' },
] as const

const BASELINE = join(ROOT, 'baseline.json')

async function buildRouter(catalog: string): Promise<SkillRouter> {
  const registry = await buildSkillRegistry({
    roots: { global: [join(ROOT, catalog)], project: [] },
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

  return createSkillRouter(registry.repository)
}

async function loadReport(): Promise<EvaluationReport> {
  const routers = new Map<string, SkillRouter>()
  const datasets: DatasetReport[] = []

  for (const { name, catalog } of DATASETS) {
    let router = routers.get(catalog)

    if (router === undefined) {
      router = await buildRouter(catalog)
      routers.set(catalog, router)
    }

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
