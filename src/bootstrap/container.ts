import { isAbsolute, resolve } from 'node:path'

import { createFilesystemSkillContentReader } from '../infrastructure/registry/filesystem-skill-content-reader.js'
import { createGetSkill } from '../application/get-skill.js'
import { createGetSkillReference } from '../application/get-skill-reference.js'
import { createMcpServer } from '../adapters/mcp/server.js'
import { createSearchSkills } from '../application/search-skills.js'
import { createSkillRouter } from '../router/skill-router.js'
import { buildSkillRegistry } from '../infrastructure/registry/registry-builder.js'
import { loadConfig } from '../infrastructure/config/config-loader.js'
import { registerGetSkill } from '../adapters/mcp/tools/get-skill.js'
import { registerGetSkillReference } from '../adapters/mcp/tools/get-skill-reference.js'
import { registerSearchSkills } from '../adapters/mcp/tools/search-skills.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegistryDiagnostic } from '../infrastructure/registry/registry-builder.js'
import type { SkillRouterConfig } from '../infrastructure/config/config-schema.js'

export interface ContainerOptions {
  readonly configPath?: string | undefined
  readonly cwd?: string | undefined
}

export interface Container {
  readonly server: McpServer
  readonly config: SkillRouterConfig
  /** Roots and skills that could not be loaded. Reported, never swallowed. */
  readonly diagnostics: readonly RegistryDiagnostic[]
}

/**
 * Wires everything together, and is the only place that knows about every
 * layer at once.
 *
 * Composition lives here so the adapter can stay a thin mapping and the router
 * can stay unaware that MCP exists.
 */
export async function createContainer(options: ContainerOptions = {}): Promise<Container> {
  const cwd = options.cwd ?? process.cwd()
  const config = await loadConfig(options.configPath, cwd)
  // The base policy is the strict one. Only the registry widens it, and only
  // for a global root; the reader keeps it, so a reference can never resolve
  // outside the skill that offers it (ADR-0013).
  const policy = { followSymlinks: config.security.followSymlinks, linksMayLeaveRoot: false }

  const registry = await buildSkillRegistry({
    roots: {
      global: [...config.roots.global],
      // Project roots are written relative to the workspace, not to wherever
      // the server process happens to have been started.
      project: config.roots.project.map((spec) => ({
        ...spec,
        path: absolute(spec.path, cwd),
      })),
    },
    policy,
    limits: { maxSkills: config.security.maxSkills },
  })

  const reader = createFilesystemSkillContentReader(registry.entries, policy, {
    maxReferenceBytes: config.security.maxReferenceSizeKb * 1024,
  })

  const router = createSkillRouter(registry.repository, { weights: config.ranking.weights })
  const server = createMcpServer()

  registerSearchSkills(server, createSearchSkills(router, config.search))
  registerGetSkill(server, createGetSkill(registry.repository, reader))
  registerGetSkillReference(server, createGetSkillReference(registry.repository, reader))

  return { server, config, diagnostics: registry.diagnostics }
}

function absolute(root: string, cwd: string): string {
  return isAbsolute(root) || root.startsWith('~') ? root : resolve(cwd, root)
}
