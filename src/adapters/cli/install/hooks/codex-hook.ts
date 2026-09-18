import { join } from 'node:path'

import { CODEX_HOOK_SCRIPT } from './hook-scripts.generated.js'
import {
  HOOK_FILENAME,
  HOOK_STATUS_MESSAGE,
  HOOK_TIMEOUT_SECONDS,
  type HookTarget,
} from './hook-target.js'
import type { InstallEnvironment } from '../environment.js'

/**
 * Where Codex keeps its hooks, and what it should run.
 *
 * `hooks.json`, not the `config.toml` that carries its MCP servers: Codex reads
 * hooks from a file of their own.
 *
 * The matcher is `.*` because the Codex script filters for itself. It skips
 * calls to this very server, then pulls every string out of `tool_input` and
 * looks for a skills directory, which is what it takes to cover a client whose
 * tools do not agree on a field name. Narrowing the matcher would split that
 * decision across two files that can drift apart.
 *
 * The command resolves `CODEX_HOME` the way Codex does, and the script is
 * written under the same directory, so moving Codex's home moves both.
 */
export function codexHookTarget(environment: InstallEnvironment): HookTarget {
  const home = codexHome(environment)

  return {
    label: 'Codex',
    scriptPath: join(home, 'hooks', HOOK_FILENAME),
    configPath: join(home, 'hooks.json'),
    script: CODEX_HOOK_SCRIPT,
    entry: {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: `bash "\${CODEX_HOME:-$HOME/.codex}/hooks/${HOOK_FILENAME}"`,
          timeout: HOOK_TIMEOUT_SECONDS,
          statusMessage: HOOK_STATUS_MESSAGE,
        },
      ],
    },
  }
}

function codexHome(environment: InstallEnvironment): string {
  return environment.codexHome ?? join(environment.home, '.codex')
}
