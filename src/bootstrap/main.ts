#!/usr/bin/env node
import { homedir } from 'node:os'

import { createProcessRunner } from '../adapters/cli/command-runner.js'
import { resolveServerCommand } from '../adapters/cli/install/server-command.js'
import { runCli } from '../adapters/cli/run-cli.js'
import { startStdio } from './start-stdio.js'

/**
 * The binary.
 *
 * With no argument it serves over stdio, which is how an MCP client launches
 * it, so adding subcommands did not change how any client is configured.
 *
 * Sets `process.exitCode` rather than calling `process.exit`, so a pending
 * write to stdout or stderr is never truncated on the way out.
 */
const exitCode = await runCli(process.argv.slice(2), {
  serve: startStdio,
  run: createProcessRunner(),
  environment: {
    cwd: process.cwd(),
    home: homedir(),
    configHome: process.env.XDG_CONFIG_HOME,
  },
  serverCommand: resolveServerCommand(import.meta.url),
  out: (line) => {
    console.log(line)
  },
  err: (line) => {
    console.error(line)
  },
}).catch((error: unknown) => {
  console.error('skill-router-mcp failed:', error)

  return 1
})

process.exitCode = exitCode
