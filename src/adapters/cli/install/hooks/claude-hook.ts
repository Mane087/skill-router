import { join } from 'node:path'

import { CLAUDE_HOOK_SCRIPT } from './hook-scripts.generated.js'
import {
  HOOK_FILENAME,
  HOOK_STATUS_MESSAGE,
  HOOK_TIMEOUT_SECONDS,
  type HookTarget,
} from './hook-target.js'
import type { InstallEnvironment } from '../environment.js'

/**
 * Where Claude Code keeps its hooks, and what it should run.
 *
 * The matcher names the tools Claude Code reaches for when it looks for a skill
 * by hand: `Skill` loads one, and `Read`, `Glob` and `Grep` are how it walks a
 * catalogue of `SKILL.md` files. The script itself decides whether a particular
 * call is about skills at all, so a wider matcher would only cost a process.
 *
 * The command is spelled with `~` rather than an absolute home directory,
 * because that is the form Claude Code's own documentation uses and a settings
 * file is often carried between machines whose home directories differ.
 */
export function claudeHookTarget(environment: InstallEnvironment): HookTarget {
  const home = join(environment.home, '.claude')

  return {
    label: 'Claude Code',
    scriptPath: join(home, 'hooks', HOOK_FILENAME),
    configPath: join(home, 'settings.json'),
    script: CLAUDE_HOOK_SCRIPT,
    entry: {
      matcher: 'Skill|Read|Glob|Grep',
      hooks: [
        {
          type: 'command',
          command: `bash ~/.claude/hooks/${HOOK_FILENAME}`,
          timeout: HOOK_TIMEOUT_SECONDS,
          statusMessage: HOOK_STATUS_MESSAGE,
        },
      ],
    },
  }
}
