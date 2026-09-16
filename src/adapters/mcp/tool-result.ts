import { SkillRouterError } from '../../domain/errors.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Runs a use case and renders its outcome as an MCP tool result.
 *
 * Expected domain failures become error results carrying their `code`, so a
 * client can tell "no such skill" from "the server broke". Anything else is
 * left to propagate: an unexpected failure must not be dressed up as a normal
 * answer.
 */
export async function toToolResult<T extends object>(
  run: () => Promise<T>,
): Promise<CallToolResult> {
  try {
    const value = await run()

    return {
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      // The SDK types structured content as an open record. Our results are
      // closed interfaces, so this widening is a boundary conversion, not an
      // unchecked assumption about a value of unknown shape.
      structuredContent: value as unknown as Record<string, unknown>,
    }
  } catch (error) {
    if (error instanceof SkillRouterError) {
      return {
        content: [{ type: 'text', text: `${error.code}: ${error.message}` }],
        isError: true,
      }
    }

    throw error
  }
}
