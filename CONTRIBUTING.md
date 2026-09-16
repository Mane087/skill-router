# Contributing

## Getting set up

```bash
pnpm install
pnpm test
```

Node 24 (see `.nvmrc`) and pnpm 11. Installation runs no package scripts and
refuses releases younger than a day, both configured in `pnpm-workspace.yaml`.

## The loop

Work test-first. Write the test, watch it fail for the reason you expect, then
make it pass. A test that passed the moment you wrote it has not shown it can
catch anything.

```bash
pnpm test          # unit, integration, contract and security tests
pnpm eval          # retrieval quality against the stored baseline
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm test` and `pnpm eval` answer different questions. The suite can be green
while the router retrieves the wrong skills, which is what the evaluation
measures.

## Changing the ranking

Any change to weights, signals or admission must be measured, not argued:

```bash
pnpm eval                 # compare against evals/baseline.json
pnpm eval:baseline        # only once the new numbers are the intended ones
```

The run fails if a metric moves the wrong way, so a ranking change has to be
looked at deliberately. Say in the pull request what moved and why the trade
is worth it — recall bought with false positives is usually a bad trade here.

Fourteen cases is not a representative dataset. Adding cases is more valuable
than tuning weights against the ones that exist.

## Architecture rules

Dependencies point inwards: `domain` ← `application` ← `infrastructure` and
`adapters`. Four rules are enforced by lint rather than by review, so a
violation fails CI:

- `domain` imports no Node built-in, no MCP and no Zod.
- `router` imports no MCP and no filesystem.
- `application` depends on ports, not on concrete infrastructure.
- the MCP adapter does not reach into `router`.

Validate every external input: tool arguments, configuration, YAML and paths.
Nothing read from a skill is ever executed.

## Pull requests

`main` is protected. Open a pull request; CI, both CodeQL analyses and the
dependency review must pass before it can merge.

Use conventional commit subjects (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`).
Explain in the body why the change is right, not what the diff already shows.

## Reporting a vulnerability

Privately, through a security advisory. See [SECURITY.md](SECURITY.md).
