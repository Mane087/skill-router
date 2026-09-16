import { z } from 'zod'

import { DEFAULT_RANKING_WEIGHTS } from '../../router/scoring/weights.js'
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../../domain/skill/skill-query.js'
import { InvalidConfigError } from '../../domain/errors.js'
import type { RankingWeights } from '../../router/scoring/weights.js'

export interface SkillRouterConfig {
  readonly version: number
  readonly roots: {
    readonly global: readonly string[]
    readonly project: readonly string[]
  }
  readonly search: {
    readonly defaultLimit: number
    readonly maxLimit: number
  }
  readonly security: {
    readonly maxReferenceSizeKb: number
    readonly maxSkills: number
    readonly followSymlinks: boolean
  }
  readonly ranking: {
    readonly weights: RankingWeights
  }
}

export const DEFAULT_CONFIG: SkillRouterConfig = {
  version: 1,
  roots: {
    global: ['~/.agent-skills'],
    project: ['.skills'],
  },
  search: {
    defaultLimit: DEFAULT_SEARCH_LIMIT,
    maxLimit: MAX_SEARCH_LIMIT,
  },
  security: {
    maxReferenceSizeKb: 512,
    maxSkills: 500,
    // Refusing links is the mitigation for the check-then-use gap in path
    // resolution, so it is the default rather than an opt-in.
    followSymlinks: false,
  },
  ranking: {
    weights: DEFAULT_RANKING_WEIGHTS,
  },
}

const positiveInt = z.int().positive()

const weightsSchema = z
  .strictObject({
    phase: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.phase),
    framework: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.framework),
    intent: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.intent),
    file: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.file),
    language: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.language),
    tag: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.tag),
    related: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.related),
  })
  .prefault({ ...DEFAULT_RANKING_WEIGHTS })

const configSchema = z
  .strictObject({
    version: positiveInt.default(DEFAULT_CONFIG.version),
    roots: z
      .strictObject({
        global: z.array(z.string().min(1)).default([...DEFAULT_CONFIG.roots.global]),
        project: z.array(z.string().min(1)).default([...DEFAULT_CONFIG.roots.project]),
      })
      .prefault({
        global: [...DEFAULT_CONFIG.roots.global],
        project: [...DEFAULT_CONFIG.roots.project],
      }),
    search: z
      .strictObject({
        defaultLimit: positiveInt.default(DEFAULT_CONFIG.search.defaultLimit),
        maxLimit: positiveInt.default(DEFAULT_CONFIG.search.maxLimit),
      })
      .prefault({ ...DEFAULT_CONFIG.search }),
    security: z
      .strictObject({
        maxReferenceSizeKb: positiveInt.default(DEFAULT_CONFIG.security.maxReferenceSizeKb),
        maxSkills: positiveInt.default(DEFAULT_CONFIG.security.maxSkills),
        followSymlinks: z.boolean().default(DEFAULT_CONFIG.security.followSymlinks),
      })
      .prefault({ ...DEFAULT_CONFIG.security }),
    ranking: z.strictObject({ weights: weightsSchema }).prefault({
      weights: { ...DEFAULT_RANKING_WEIGHTS },
    }),
  })
  .refine((config) => config.search.defaultLimit <= config.search.maxLimit, {
    message: 'search.defaultLimit must not exceed search.maxLimit.',
    path: ['search', 'defaultLimit'],
  })

/**
 * Validates configuration, filling in every field the file leaves out.
 *
 * Unknown fields are rejected rather than ignored: silently dropping a
 * misspelled `followLinks` would leave the server running with a security
 * setting the operator believed they had changed.
 *
 * @throws {InvalidConfigError} listing the fields that failed.
 */
export function parseConfig(input: unknown): SkillRouterConfig {
  const result = configSchema.safeParse(input)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join('; ')

    throw new InvalidConfigError(`Invalid configuration. ${details}`)
  }

  return result.data
}
