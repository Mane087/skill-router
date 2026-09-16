import { combineSignals } from '../domain/ranking/score.js'
import { explainMatch } from './explanations/match-explainer.js'
import { findExclusion } from './filters/exclusion-filter.js'
import { mapRelations, scoreRelation, scoreSkill } from './scoring/composite-scorer.js'
import { DEFAULT_RANKING_WEIGHTS } from './scoring/weights.js'
import { formatSkillId } from '../domain/skill/skill-id.js'
import type { RankingSignal } from '../domain/ranking/ranking-reason.js'
import type { SignalScore } from '../domain/ranking/score.js'
import type { SkillMatch } from '../domain/skill/skill-match.js'
import type { SkillQuery } from '../domain/skill/skill-query.js'
import type { SkillRepository } from '../application/ports/skill-repository.js'
import type { Skill } from '../domain/skill/skill.js'
import type { RankingWeights } from './scoring/weights.js'

export interface SkillRouterOptions {
  readonly weights?: RankingWeights
}

export interface SkillRouter {
  search(query: SkillQuery): Promise<readonly SkillMatch[]>
}

/**
 * Signals that say something about the subject of the task.
 *
 * Phase and relation are deliberately absent. Phase is context, not subject:
 * nearly every skill declares `implementation`, so matching it proves nothing
 * about the topic. A relation says only that some other skill vouches for this
 * one. Both reposition a skill that is already relevant; neither makes one
 * relevant.
 */
const SUBJECT_SIGNALS: readonly RankingSignal[] = ['framework', 'language', 'intent', 'file', 'tag']

interface Candidate {
  readonly skill: Skill
  readonly signals: readonly SignalScore[]
}

/**
 * Selects the skills most likely to be relevant to a query.
 *
 * The pipeline is: drop excluded skills, score the rest on their own metadata,
 * keep those that matched something, then let relations between survivors
 * adjust the ranking.
 *
 * Note on hard filters: the plan sketches separate phase and framework filters,
 * but applying either as an exclusion contradicts its own milestone, where a
 * testing skill must still surface on an implementation task. So phase and
 * framework decide score, not membership, and the only hard filter is negative
 * metadata. A skill that matches nothing is dropped, which is what keeps the
 * candidate set small.
 *
 * Depends on the repository port alone: no filesystem, no MCP, no I/O beyond
 * the one call to list the skills.
 */
export function createSkillRouter(
  repository: SkillRepository,
  options: SkillRouterOptions = {},
): SkillRouter {
  const weights = options.weights ?? DEFAULT_RANKING_WEIGHTS

  return {
    async search(query: SkillQuery): Promise<readonly SkillMatch[]> {
      const candidates = selectCandidates(await repository.list(), query, weights)
      const relatedBy = mapRelations(candidates.map((candidate) => candidate.skill))

      return candidates
        .map((candidate) => toMatch(candidate, relatedBy, weights))
        .sort(byScoreThenIdentity)
        .slice(0, query.limit)
    },
  }
}

function selectCandidates(
  skills: readonly Skill[],
  query: SkillQuery,
  weights: RankingWeights,
): readonly Candidate[] {
  const candidates: Candidate[] = []

  for (const skill of skills) {
    if (findExclusion(skill, query) !== null) {
      continue
    }

    const signals = scoreSkill(skill, query, weights)

    // Requires a subject match, not merely a positive score. Without this,
    // every skill declaring the requested phase was retrieved for every task,
    // which the evaluation suite measured as a 67% false positive rate.
    if (matchesSubject(signals)) {
      candidates.push({ skill, signals })
    }
  }

  return candidates
}

function matchesSubject(signals: readonly SignalScore[]): boolean {
  return signals.some((score) => score.ratio > 0 && SUBJECT_SIGNALS.includes(score.signal))
}

function toMatch(
  candidate: Candidate,
  relatedBy: ReturnType<typeof mapRelations>,
  weights: RankingWeights,
): SkillMatch {
  const signals = [...candidate.signals, scoreRelation(candidate.skill, relatedBy, weights.related)]

  return {
    id: candidate.skill.id,
    scope: candidate.skill.id.scope,
    score: combineSignals(signals),
    reasons: explainMatch(signals),
  }
}

/** Identity breaks ties, so equal scores keep a stable, reproducible order. */
function byScoreThenIdentity(left: SkillMatch, right: SkillMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score
  }

  // Identities are unique within a registry, so there is no equal case here.
  return formatSkillId(left.id) < formatSkillId(right.id) ? -1 : 1
}
