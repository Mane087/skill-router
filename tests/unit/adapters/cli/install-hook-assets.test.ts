import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLAUDE_HOOK_SCRIPT,
  CODEX_HOOK_SCRIPT,
} from '../../../../src/adapters/cli/install/hooks/hook-scripts.generated.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

/**
 * The generated module is what the compiled binary carries, and the files under
 * assets/ are what a person edits. Nothing at runtime would notice them drifting
 * apart: the binary would keep installing yesterday's script forever. This is
 * the only thing that notices, so it fails the suite instead.
 */
describe('the generated hook scripts', () => {
  it.each([
    ['assets/hook_claude.sh', CLAUDE_HOOK_SCRIPT],
    ['assets/hook_codex.sh', CODEX_HOOK_SCRIPT],
  ])('carries %s byte for byte', async (source, generated) => {
    expect(generated).toBe(await readFile(join(ROOT, source), 'utf8'))
  })

  it.each([
    ['Claude', CLAUDE_HOOK_SCRIPT],
    ['Codex', CODEX_HOOK_SCRIPT],
  ])('starts the %s script with a shebang, since the hook is run as a file', (_client, script) => {
    expect(script.startsWith('#!/usr/bin/env bash')).toBe(true)
  })

  it.each([
    ['Claude', CLAUDE_HOOK_SCRIPT],
    ['Codex', CODEX_HOOK_SCRIPT],
  ])('answers the %s hook with the PreToolUse event it was called for', (_client, script) => {
    expect(script).toContain('hookEventName: "PreToolUse"')
  })
})
