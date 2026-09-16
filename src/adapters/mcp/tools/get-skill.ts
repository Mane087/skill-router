import { z } from 'zod'

import { toToolResult } from '../tool-result.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetSkill } from '../../../application/get-skill.js'

const inputSchema = {
  id: z.string().describe('Scope-qualified identity, such as "global:angular".'),
}

export function registerGetSkill(server: McpServer, getSkill: GetSkill): void {
  server.registerTool(
    'skills_get',
    {
      title: 'Get a skill',
      description:
        'Return the full content of one skill, plus the names of the references it offers.',
      inputSchema,
    },
    (args) => toToolResult(() => getSkill.execute(args)),
  )
}
