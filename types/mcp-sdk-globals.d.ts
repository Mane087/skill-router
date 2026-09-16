/**
 * `@modelcontextprotocol/sdk@1.30.0` uses `HeadersInit` as a global in
 * `dist/esm/shared/transport.d.ts`, but never declares it.
 *
 * `@types/node@24` provides `Headers`, `Request`, `RequestInit` and `Response`
 * globally, yet not `HeadersInit`, so typechecking fails with TS2304 unless the
 * `DOM` lib is pulled in — which would add browser globals to a Node-only
 * project — or `skipLibCheck` is enabled, which would silence every third-party
 * declaration error.
 *
 * This declaration mirrors `undici-types/fetch.d.ts` and can be deleted once the
 * SDK declares the type itself.
 */
type HeadersInit = [string, string][] | Record<string, string> | Headers
