import { z } from 'zod'

import { SKILL_PHASES } from '../../src/domain/skill/skill-manifest.js'
import type { EvaluationDataset } from './evaluate.js'

/**
 * Datasets are hand-written files, so they are validated like any other
 * external input. A typo in a field name must fail loudly instead of quietly
 * removing a signal from the evaluation.
 */
const caseSchema = z.strictObject({
  id: z.string().min(1),
  task: z.string().min(1),
  phase: z.enum(SKILL_PHASES).optional(),
  stack: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  expected: z.array(z.string()).min(1),
  notExpected: z.array(z.string()).default([]),
})

const datasetSchema = z.strictObject({
  name: z.string().min(1),
  cases: z.array(caseSchema).min(1),
})

export function parseDataset(input: unknown, source: string): EvaluationDataset {
  const result = datasetSchema.safeParse(input)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')

    throw new Error(`Invalid evaluation dataset ${source}. ${details}`)
  }

  return result.data
}
