import { z } from 'zod'

import { toToolResult } from '../tool-result.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetSkillReference } from '../../../application/get-skill-reference.js'

const inputSchema = {
  skillId: z.string().describe('Scope-qualified identity, such as "global:angular".'),
  reference: z.string().describe('Reference name as listed by skills_get, without an extension.'),
}

export function registerGetSkillReference(
  server: McpServer,
  getSkillReference: GetSkillReference,
): void {
  server.registerTool(
    'skills_get_reference',
    {
      title: 'Get a skill reference',
      description:
        'Return one reference document of a skill. The narrowest step: use it after skills_get has named the available references.',
      inputSchema,
    },
    (args) => toToolResult(() => getSkillReference.execute(args)),
  )
}
