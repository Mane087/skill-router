import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  createSkillQuery,
} from '../domain/skill/skill-query.js'
import { formatRankingReason } from '../domain/ranking/ranking-reason.js'
import { formatSkillId } from '../domain/skill/skill-id.js'
import type { SkillMatch } from '../domain/skill/skill-match.js'
import type { SkillPhase } from '../domain/skill/skill-manifest.js'
import type { SkillRouter } from '../router/skill-router.js'
import type { SkillScope } from '../domain/skill/skill-id.js'

export interface SearchSkillsInput {
  readonly task: string
  readonly phase?: SkillPhase | undefined
  readonly stack?: readonly string[] | undefined
  readonly files?: readonly string[] | undefined
  readonly keywords?: readonly string[] | undefined
  readonly limit?: number | undefined
}

export interface SkillMatchView {
  readonly id: string
  readonly scope: SkillScope
  readonly score: number
  readonly reasons: readonly string[]
}

export interface SearchSkillsResult {
  readonly skills: readonly SkillMatchView[]
}

export interface SearchSkills {
  execute(input: SearchSkillsInput): Promise<SearchSkillsResult>
}

export interface SearchLimits {
  readonly defaultLimit: number
  readonly maxLimit: number
}

const DOMAIN_LIMITS: SearchLimits = {
  defaultLimit: DEFAULT_SEARCH_LIMIT,
  maxLimit: MAX_SEARCH_LIMIT,
}

/**
 * Turns a request into a ranked shortlist.
 *
 * The use case only builds the query and renders the result: filtering,
 * scoring and ranking all belong to the router.
 */
export function createSearchSkills(
  router: SkillRouter,
  limits: SearchLimits = DOMAIN_LIMITS,
): SearchSkills {
  return {
    async execute(input: SearchSkillsInput): Promise<SearchSkillsResult> {
      const query = createSkillQuery({
        task: input.task,
        phase: input.phase ?? null,
        stack: input.stack ?? [],
        files: input.files ?? [],
        keywords: input.keywords ?? [],
        // Configuration may narrow the domain cap, never widen it: the domain
        // clamps again on its own maximum.
        limit: Math.min(input.limit ?? limits.defaultLimit, limits.maxLimit),
      })

      return { skills: (await router.search(query)).map(toView) }
    },
  }
}

function toView(match: SkillMatch): SkillMatchView {
  return {
    id: formatSkillId(match.id),
    scope: match.scope,
    score: match.score,
    // Rendered here rather than in the adapter: how a reason reads is part of
    // the result, not of the transport.
    reasons: match.reasons.map(formatRankingReason),
  }
}
