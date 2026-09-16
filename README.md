# skill-router-mcp

MCP server that discovers, ranks and retrieves agent skills so an agent loads the
smallest sufficient context instead of an entire skill catalog.

> Status: phase 1 (foundation). The MCP server starts and answers the
> `initialize` handshake, but exposes no routing tools yet.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 11

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Architecture

Dependencies point inwards: `domain` ← `application` ← `infrastructure` / `adapters`.
The router never imports the MCP SDK and the MCP adapter never implements ranking.
These boundaries are enforced by `no-restricted-imports` rules in `eslint.config.js`,
so a violation fails lint rather than relying on code review.

## License

MIT
