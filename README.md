# skill-router-mcp

MCP server that discovers, ranks and retrieves agent skills so an agent loads the
smallest sufficient context instead of an entire skill catalog.

> Status: phase 2 (skill model). Manifests are parsed and validated; the MCP
> server answers the `initialize` handshake but exposes no routing tools yet.

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

## Skills

A skill is a `SKILL.md` whose YAML frontmatter says when it is relevant. See
[docs/skill-manifest.md](docs/skill-manifest.md) for the fields, the
normalization rules, the size limits and the reasons a manifest is rejected.

## Architecture

Dependencies point inwards: `domain` ← `application` ← `infrastructure` / `adapters`.
The router never imports the MCP SDK and the MCP adapter never implements ranking.
These boundaries are enforced by `no-restricted-imports` rules in `eslint.config.js`,
so a violation fails lint rather than relying on code review.

## License

MIT
