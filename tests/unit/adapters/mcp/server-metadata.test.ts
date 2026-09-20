import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { SERVER_NAME, SERVER_VERSION } from '../../../../src/adapters/mcp/server-metadata.js'

/**
 * The identity is held as literals so the server reads no file at startup,
 * which means nothing keeps it honest except this.
 *
 * It is not cosmetic: the same value goes out in the `initialize` handshake
 * and in `--version`, so a stale constant makes every bug report from a
 * release name a version that does not exist.
 */
describe('server metadata', () => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../package.json', import.meta.url)), 'utf8'),
  ) as { readonly name: string; readonly version: string }

  it('reports the version the package declares', () => {
    expect(SERVER_VERSION).toBe(manifest.version)
  })

  it('reports the name the package declares', () => {
    expect(SERVER_NAME).toBe(manifest.name)
  })
})
