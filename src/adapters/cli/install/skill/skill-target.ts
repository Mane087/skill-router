import { join } from 'node:path'

import { SKILL_NAME } from './skill-files.generated.js'
import { userConfigDirectory } from '../environment.js'
import type { InstallClient } from '../../arguments.js'
import type { InstallEnvironment } from '../environment.js'

/** Where every one of the three clients keeps the skills it loads. */
export interface SkillTarget {
  /** How the client is named in a message to a person. */
  readonly label: string
  /** The directory the skill's files are written into, one level per file. */
  readonly directory: string
}

/**
 * Resolves the skills directory of one client for this machine.
 *
 * Always the client's own global directory, never a project one. A skill is a
 * capability of the agent rather than of a checkout: installing it per project
 * would mean a catalogue that appears and disappears as the operator changes
 * directory, so `--scope` does not reach here.
 *
 * Codex is read through `CODEX_HOME` for the same reason its hook is: that
 * variable moves everything Codex reads, and writing to `~/.codex` on a machine
 * that sets it would install a skill Codex never looks at. opencode follows the
 * XDG convention, and Claude Code follows neither.
 */
export function skillTarget(client: InstallClient, environment: InstallEnvironment): SkillTarget {
  switch (client) {
    case 'claude':
      return {
        label: 'Claude Code',
        directory: join(environment.home, '.claude', 'skills', SKILL_NAME),
      }
    case 'codex':
      return {
        label: 'Codex',
        directory: join(
          environment.codexHome ?? join(environment.home, '.codex'),
          'skills',
          SKILL_NAME,
        ),
      }
    case 'opencode':
      return {
        label: 'opencode',
        directory: join(userConfigDirectory(environment), 'opencode', 'skills', SKILL_NAME),
      }
  }
}
