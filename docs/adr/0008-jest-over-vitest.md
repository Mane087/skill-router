# 8. Jest rather than Vitest

Status: accepted

## Context

The plan specifies Vitest. Vitest handles ESM and TypeScript with no
configuration, which matters for a strict ESM project.

At the start of implementation the maintainer asked for Jest instead,
deliberately amending their own plan.

## Decision

Jest 30 with `ts-jest`, running in ESM mode.

## Consequences

**ESM needs explicit configuration**, which is what Vitest would have avoided:

- Scripts invoke `node --experimental-vm-modules node_modules/jest/bin/jest.js`
  rather than setting `NODE_OPTIONS`, so the flag works the same on every
  platform.
- `extensionsToTreatAsEsm` and a module name mapper are required, because
  TypeScript sources import siblings with an explicit `.js` extension that Jest
  must strip to resolve against the pre-compilation tree.
- Calling `jest` directly without that flag fails with a misleading error about
  CommonJS, so the pnpm scripts are the only supported entry point.

**Per-path coverage thresholds abort when a path matches no file**, so the
stricter thresholds for `router/`, `manifest/`, `filesystem/` and `registry/`
had to be added in the phase that created each directory rather than up front.

**Evaluations get their own config.** `jest.evals.config.js` keeps them out of
`pnpm test` while reusing the ESM and TypeScript setup, which avoided standing
up a second compilation pipeline just to run them.

None of this changed the design. It is configuration cost, paid once, and it is
recorded here so the next person does not mistake it for accident.
