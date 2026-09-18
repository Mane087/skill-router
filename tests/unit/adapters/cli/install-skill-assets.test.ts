import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SKILL_FILES,
  SKILL_NAME,
} from '../../../../src/adapters/cli/install/skill/skill-files.generated.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SOURCE = join(ROOT, 'assets', 'skill-router-metadata')

/** Every file under assets/, spelled the way the generated module keys them. */
async function sourceFiles(): Promise<readonly string[]> {
  const found = await readdir(SOURCE, { recursive: true, withFileTypes: true })

  return found
    .filter((entry) => entry.isFile())
    .map((entry) => relative(SOURCE, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

/**
 * The generated module is what the compiled binary carries, and the files under
 * assets/ are what a person edits. Nothing at runtime would notice them drifting
 * apart: the binary would keep installing yesterday's skill forever. This is the
 * only thing that notices, so it fails the suite instead.
 */
describe('the generated skill files', () => {
  it('carries every file under assets/, so a new reference document is not left behind', async () => {
    expect(Object.keys(SKILL_FILES).sort()).toEqual(await sourceFiles())
  })

  it('carries each of them byte for byte', async () => {
    for (const [path, contents] of Object.entries(SKILL_FILES)) {
      expect(contents).toBe(await readFile(join(SOURCE, ...path.split('/')), 'utf8'))
    }
  })

  it('carries a SKILL.md, without which no agent recognizes the directory as a skill', () => {
    expect(Object.keys(SKILL_FILES)).toContain('SKILL.md')
  })

  it('installs under the name the skill declares, since that is how an agent invokes it', () => {
    expect(SKILL_FILES['SKILL.md']).toContain(`name: ${SKILL_NAME}`)
  })

  it('keys its paths with forward slashes, which the installer splits back apart', () => {
    for (const path of Object.keys(SKILL_FILES)) {
      expect(path).not.toContain('\\')
    }
  })
})
