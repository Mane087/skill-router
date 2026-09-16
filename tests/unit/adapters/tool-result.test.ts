import { toToolResult } from '../../../src/adapters/mcp/tool-result.js'
import { SkillNotFoundError } from '../../../src/domain/errors.js'

function textOf(result: Awaited<ReturnType<typeof toToolResult>>): string {
  return (result.content[0] as { text: string }).text
}

describe('toToolResult', () => {
  it('renders a successful result as JSON text and structured content', async () => {
    const result = await toToolResult(() => Promise.resolve({ id: 'global:angular' }))

    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toEqual({ id: 'global:angular' })
    expect(textOf(result)).toContain('global:angular')
  })

  it('turns an expected domain failure into an error result carrying its code', async () => {
    const result = await toToolResult(() =>
      Promise.reject(new SkillNotFoundError('No skill registered as global:svelte.')),
    )

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('SKILL_NOT_FOUND: No skill registered as global:svelte.')
  })

  it('lets an unexpected failure propagate instead of dressing it up as an answer', async () => {
    await expect(toToolResult(() => Promise.reject(new TypeError('bug')))).rejects.toThrow(
      TypeError,
    )
  })
})
