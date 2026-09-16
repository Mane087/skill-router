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
export {
  InvalidManifestError,
  InvalidSkillIdError,
  SkillRouterError,
} from './domain/skill/errors.js'
export type { ManifestIssue } from './domain/skill/errors.js'

export { loadSkillDocument } from './infrastructure/manifest/skill-manifest-loader.js'
export type { LoadedSkillDocument } from './infrastructure/manifest/skill-manifest-loader.js'
