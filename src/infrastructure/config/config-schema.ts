import { z } from 'zod'

import { DEFAULT_RANKING_WEIGHTS } from '../../router/scoring/weights.js'
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../../domain/skill/skill-query.js'
import { InvalidConfigError } from '../../domain/errors.js'
import { describeInvalidRootPattern } from '../filesystem/skill-root.js'
import type { RankingWeights } from '../../router/scoring/weights.js'
import type { SkillRootSpec } from '../filesystem/skill-root.js'

/**
 * Where each agent keeps skills, scanned in this order.
 *
 * These are the conventions the tools themselves document, not a layout this
 * project invented: a server with no configuration should find the skills a
 * machine already has (ADR-0014). Order decides a tie, since the first root of
 * a scope wins a duplicate name.
 *
 * The plugin pattern matches `<marketplace>/<plugin>/<version>/skills`, which
 * is why it is a pattern: the version sits in the path.
 */
export const DEFAULT_GLOBAL_ROOTS: readonly string[] = [
  '~/.claude/skills',
  '~/.claude/plugins/cache/*/*/*/skills',
  '~/.codex/skills',
  '~/.config/opencode/skills',
  '~/.agents/skills',
]

export const DEFAULT_PROJECT_ROOTS: readonly string[] = [
  '.claude/skills',
  '.codex/skills',
  '.opencode/skills',
  '.agents/skills',
  '.skills',
]

export interface SkillRouterConfig {
  readonly version: number
  readonly roots: {
    readonly global: readonly SkillRootSpec[]
    readonly project: readonly SkillRootSpec[]
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
    global: assumedRoots(DEFAULT_GLOBAL_ROOTS),
    project: assumedRoots(DEFAULT_PROJECT_ROOTS),
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

/** Roots this project assumes, which stay silent when they are not there. */
function assumedRoots(paths: readonly string[]): readonly SkillRootSpec[] {
  return paths.map((path) => ({ path, required: false }))
}

/** Roots the operator wrote, whose absence is worth reporting. */
function configuredRoots(paths: readonly string[]): readonly SkillRootSpec[] {
  return paths.map((path) => ({ path, required: true }))
}

const rootPath = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    const problem = describeInvalidRootPattern(value)

    if (problem !== null) {
      ctx.addIssue({ code: 'custom', message: problem })
    }
  })

const rootList = z.array(rootPath)

const weightsSchema = z
  .strictObject({
    phase: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.phase),
    framework: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.framework),
    intent: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.intent),
    file: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.file),
    language: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.language),
    tag: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.tag),
    description: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.description),
    related: z.int().nonnegative().default(DEFAULT_RANKING_WEIGHTS.related),
  })
  .prefault({ ...DEFAULT_RANKING_WEIGHTS })

const configSchema = z
  .strictObject({
    version: positiveInt.default(DEFAULT_CONFIG.version),
    // Left optional rather than defaulted, because the parsed value has to say
    // whether a root was asked for or assumed. Writing `global: []` is a
    // choice and is kept: it means this machine has no global skills.
    roots: z
      .strictObject({
        global: rootList.optional(),
        project: rootList.optional(),
      })
      .prefault({})
      .transform((roots) => ({
        global:
          roots.global === undefined
            ? assumedRoots(DEFAULT_GLOBAL_ROOTS)
            : configuredRoots(roots.global),
        project:
          roots.project === undefined
            ? assumedRoots(DEFAULT_PROJECT_ROOTS)
            : configuredRoots(roots.project),
      })),
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
