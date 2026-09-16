import { z } from 'zod'

import { SKILL_PHASES } from '../../../domain/skill/skill-manifest.js'
import { toToolResult } from '../tool-result.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SearchSkills } from '../../../application/search-skills.js'

const inputSchema = {
  task: z.string().describe('What the agent is about to do, in its own words.'),
  phase: z
    .enum(SKILL_PHASES)
    .optional()
    .describe('Lifecycle phase of the task. The strongest ranking signal.'),
  stack: z.array(z.string()).optional().describe('Languages and frameworks in play, in any order.'),
  files: z.array(z.string()).optional().describe('Paths the task touches.'),
  keywords: z.array(z.string()).optional().describe('Extra terms not present in the task.'),
  limit: z.number().int().positive().optional().describe('How many skills to return.'),
}

/**
 * The adapter maps transport to use case and nothing else: no filtering, no
 * scoring, no filesystem access (architecture rule 3).
 */
export function registerSearchSkills(server: McpServer, searchSkills: SearchSkills): void {
  server.registerTool(
    'skills_search',
    {
      title: 'Search skills',
      description:
        'Find the skills most likely to be relevant to a task. Returns a short ranked list with the reason each one was selected, not their content.',
      inputSchema,
    },
    (args) => toToolResult(() => searchSkills.execute(args)),
  )
}
