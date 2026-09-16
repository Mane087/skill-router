import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import { parse } from 'yaml'

import { InvalidConfigError } from '../../domain/errors.js'
import { parseConfig } from './config-schema.js'
import type { SkillRouterConfig } from './config-schema.js'

export const CONFIG_FILENAME = 'skill-router.config.yaml'

/** Same bound as a skill manifest: configuration is never large. */
const MAX_CONFIG_BYTES = 64 * 1024

/**
 * Loads configuration from a YAML file, falling back to defaults.
 *
 * A missing file is not an error: running with no configuration at all is the
 * expected first experience. A malformed one is, since starting with settings
 * the operator did not intend is worse than not starting.
 *
 * @throws {InvalidConfigError} when the file exists but cannot be used.
 */
export async function loadConfig(
  path: string | undefined,
  cwd: string = process.cwd(),
): Promise<SkillRouterConfig> {
  const explicit = path !== undefined
  const file = explicit ? absolute(path, cwd) : resolve(cwd, CONFIG_FILENAME)
  let raw: string

  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (explicit) {
      throw new InvalidConfigError(`Configuration file cannot be read: ${file}. ${describe(error)}`)
    }

    return parseConfig({})
  }

  if (Buffer.byteLength(raw, 'utf8') > MAX_CONFIG_BYTES) {
    throw new InvalidConfigError(
      `Configuration file exceeds ${String(MAX_CONFIG_BYTES / 1024)} KB: ${file}`,
    )
  }

  return parseConfig(parseYaml(raw, file))
}

function parseYaml(raw: string, file: string): unknown {
  try {
    return parse(raw, { version: '1.2', schema: 'core', uniqueKeys: true })
  } catch (error) {
    throw new InvalidConfigError(
      `Configuration file is not valid YAML: ${file}. ${describe(error)}`,
    )
  }
}

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
