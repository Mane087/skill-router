import {
  countForbidden,
  falsePositiveRate,
  ndcgAt,
  precisionAt,
  recallAt,
  reciprocalRank,
} from './metrics.js'
import { createSkillQuery } from '../../src/domain/skill/skill-query.js'
import type { SkillPhase } from '../../src/domain/skill/skill-manifest.js'
import type { SkillRouter } from '../../src/router/skill-router.js'

/** How many results each case asks for, which fixes the @5 cut-offs. */
const EVALUATION_LIMIT = 5

export interface EvaluationCase {
  readonly id: string
  readonly task: string
  readonly phase?: SkillPhase | undefined
  readonly stack?: readonly string[]
  readonly files?: readonly string[]
  readonly keywords?: readonly string[]
  /** Skills that should be retrieved. Order is not graded, membership is. */
  readonly expected: readonly string[]
  /** Skills that must never be retrieved for this task. */
  readonly notExpected?: readonly string[]
}

export interface EvaluationDataset {
  readonly name: string
  readonly cases: readonly EvaluationCase[]
}

export interface CaseOutcome {
  readonly id: string
  readonly returned: readonly string[]
  readonly recallAt1: number
  readonly recallAt3: number
  readonly recallAt5: number
  readonly precisionAt3: number
  readonly precisionAt5: number
  readonly reciprocalRank: number
  readonly ndcgAt5: number
  readonly forbidden: number
  readonly falsePositiveRate: number
}

export interface EvaluationSummary {
  readonly cases: number
  readonly recallAt1: number
  readonly recallAt3: number
  readonly recallAt5: number
  readonly precisionAt3: number
  readonly precisionAt5: number
  readonly mrr: number
  readonly ndcgAt5: number
  readonly falsePositiveRate: number
  /** Share of cases that surfaced at least one forbidden skill. */
  readonly forbiddenRate: number
}

export interface DatasetReport {
  readonly name: string
  readonly outcomes: readonly CaseOutcome[]
  readonly summary: EvaluationSummary
}

export async function evaluateDataset(
  router: SkillRouter,
  dataset: EvaluationDataset,
): Promise<DatasetReport> {
  const outcomes: CaseOutcome[] = []

  for (const testCase of dataset.cases) {
    outcomes.push(await evaluateCase(router, testCase))
  }

  return { name: dataset.name, outcomes, summary: summarize(outcomes) }
}

async function evaluateCase(router: SkillRouter, testCase: EvaluationCase): Promise<CaseOutcome> {
  const query = createSkillQuery({
    task: testCase.task,
    phase: testCase.phase ?? null,
    stack: testCase.stack ?? [],
    files: testCase.files ?? [],
    keywords: testCase.keywords ?? [],
    limit: EVALUATION_LIMIT,
  })

  const returned = (await router.search(query)).map((match) => match.id.name)
  const { expected } = testCase
  const notExpected = testCase.notExpected ?? []

  return {
    id: testCase.id,
    returned,
    recallAt1: recallAt(returned, expected, 1),
    recallAt3: recallAt(returned, expected, 3),
    recallAt5: recallAt(returned, expected, 5),
    precisionAt3: precisionAt(returned, expected, 3),
    precisionAt5: precisionAt(returned, expected, 5),
    reciprocalRank: reciprocalRank(returned, expected),
    ndcgAt5: ndcgAt(returned, expected, 5),
    forbidden: countForbidden(returned, notExpected, 5),
    falsePositiveRate: falsePositiveRate(returned, expected, 5),
  }
}

export function summarize(outcomes: readonly CaseOutcome[]): EvaluationSummary {
  if (outcomes.length === 0) {
    return {
      cases: 0,
      recallAt1: 0,
      recallAt3: 0,
      recallAt5: 0,
      precisionAt3: 0,
      precisionAt5: 0,
      mrr: 0,
      ndcgAt5: 0,
      falsePositiveRate: 0,
      forbiddenRate: 0,
    }
  }

  const mean = (pick: (outcome: CaseOutcome) => number): number =>
    outcomes.reduce((sum, outcome) => sum + pick(outcome), 0) / outcomes.length

  return {
    cases: outcomes.length,
    recallAt1: mean((outcome) => outcome.recallAt1),
    recallAt3: mean((outcome) => outcome.recallAt3),
    recallAt5: mean((outcome) => outcome.recallAt5),
    precisionAt3: mean((outcome) => outcome.precisionAt3),
    precisionAt5: mean((outcome) => outcome.precisionAt5),
    mrr: mean((outcome) => outcome.reciprocalRank),
    ndcgAt5: mean((outcome) => outcome.ndcgAt5),
    falsePositiveRate: mean((outcome) => outcome.falsePositiveRate),
    forbiddenRate: mean((outcome) => (outcome.forbidden > 0 ? 1 : 0)),
  }
}
