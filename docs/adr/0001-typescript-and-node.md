# 1. TypeScript on Node, strict, ESM

Status: accepted

## Context

The server has to speak MCP, and the reference SDK is TypeScript. It also has
to parse metadata written by other people and resolve paths derived from
agent-supplied input, so a type system that can express "this value is not yet
validated" is worth real money here.

## Decision

Node 24 with TypeScript in strict mode, ESM modules, pnpm as the package
manager.

Strictness is not partial. `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `verbatimModuleSyntax` are on, and
`skipLibCheck` stays **off**, so third-party declarations are checked too.

## Consequences

**TypeScript 7 is unusable.** It is the latest release, but `ts-jest` requires
`typescript >=4.3 <7` and `typescript-eslint` requires `>=4.8.4 <6.1.0`. With
`strictPeerDependencies` enabled, installation fails outright. The project runs
on 6.0.3, which satisfies both.

**Keeping `skipLibCheck` off has a real cost, paid once.** The MCP SDK's own
declarations use `HeadersInit` as a global without declaring it, and
`@types/node` provides `Headers` and `RequestInit` but not that one. Rather than
silence every third-party declaration error or pull the whole `DOM` lib into a
Node project, `types/mcp-sdk-globals.d.ts` declares that single type. It is
deletable the day the SDK fixes it.

**ESM is not free with Jest.** Tests need `--experimental-vm-modules` and a
module name mapper that strips the `.js` extension NodeNext requires in
TypeScript imports.

**`@types/node` must track the runtime's major line.** Its `latest` tag points
at the Node 22 line, and Dependabot proposed a jump to 26 while the project
targets 24. Types for a newer runtime describe APIs that do not exist on the
one in use, which would let the typecheck approve code that fails when it runs.
Major bumps of that package are pinned.
