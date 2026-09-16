export { createMcpServer } from './adapters/mcp/server.js'
export type { McpServerIdentity } from './adapters/mcp/server.js'
export { SERVER_NAME, SERVER_VERSION } from './adapters/mcp/server-metadata.js'

export { createSkill } from './domain/skill/skill.js'
export type { Skill } from './domain/skill/skill.js'
export {
  createSkillId,
  formatSkillId,
  parseSkillId,
  skillIdEquals,
} from './domain/skill/skill-id.js'
export type { SkillId, SkillScope } from './domain/skill/skill-id.js'
export { SKILL_PHASES } from './domain/skill/skill-manifest.js'
export type { SkillExclusions, SkillManifest, SkillPhase } from './domain/skill/skill-manifest.js'
export { InvalidManifestError, InvalidSkillIdError } from './domain/skill/errors.js'
export type { ManifestIssue } from './domain/skill/errors.js'
export { DuplicateSkillError, SkillRouterError, UnsafePathError } from './domain/errors.js'

export { loadSkillDocument } from './infrastructure/manifest/skill-manifest-loader.js'
export type { LoadedSkillDocument } from './infrastructure/manifest/skill-manifest-loader.js'

export type { SkillRepository } from './application/ports/skill-repository.js'
export { buildSkillRegistry } from './infrastructure/registry/registry-builder.js'
export type {
  RegistryDiagnostic,
  RegistryOptions,
  SkillRegistry,
  SkillRoots,
} from './infrastructure/registry/registry-builder.js'
export type { ScanLimits, ScannedSkill } from './infrastructure/registry/skill-scanner.js'
export type { PathPolicy } from './infrastructure/filesystem/safe-path.js'

export {
  createSkillQuery,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from './domain/skill/skill-query.js'
export type { SkillQuery, SkillQueryInput } from './domain/skill/skill-query.js'
export type { SkillMatch } from './domain/skill/skill-match.js'
export { formatRankingReason, RANKING_SIGNALS } from './domain/ranking/ranking-reason.js'
export type { RankingReason, RankingSignal } from './domain/ranking/ranking-reason.js'
export type { SignalScore } from './domain/ranking/score.js'
export { createSkillRouter } from './router/skill-router.js'
export type { SkillRouter, SkillRouterOptions } from './router/skill-router.js'
export { DEFAULT_RANKING_WEIGHTS } from './router/scoring/weights.js'
export type { RankingWeights } from './router/scoring/weights.js'
