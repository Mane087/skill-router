import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Architecture rules from the plan (section 27) are enforced here as import
 * restrictions so violations fail lint instead of relying on code review.
 */
const DOMAIN_FORBIDDEN = [
  {
    group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process'],
    message: 'Rule 1: domain must not depend on the filesystem or any Node built-in.',
  },
  { group: ['@modelcontextprotocol/*'], message: 'Rule 1: domain must not depend on MCP.' },
  {
    group: ['zod'],
    message:
      'Rule 1: domain must not depend on Zod. Validate in infrastructure and pass normalized models in.',
  },
  {
    group: ['**/infrastructure/**', '**/adapters/**', '**/application/**', '**/router/**'],
    message: 'Rule 1: domain is the innermost layer and must not import outer layers.',
  },
]

const APPLICATION_FORBIDDEN = [
  {
    group: ['@modelcontextprotocol/*'],
    message: 'Application must not depend on MCP; the adapter maps transport to use cases.',
  },
  {
    group: ['**/infrastructure/**', '**/adapters/**'],
    message: 'Application depends on ports, not on concrete infrastructure or adapters.',
  },
]

const ROUTER_FORBIDDEN = [
  { group: ['@modelcontextprotocol/*'], message: 'Rule 2: the router must not depend on MCP.' },
  {
    group: ['node:*', 'fs', 'fs/*', 'path'],
    message: 'Rule 2: the router must be testable without a filesystem.',
  },
  {
    group: ['**/adapters/**', '**/infrastructure/**'],
    message: 'Rule 2: the router must not depend on infrastructure or adapters.',
  },
]

const MCP_ADAPTER_FORBIDDEN = [
  {
    group: ['**/router/**'],
    message:
      'Rule 3: the MCP adapter must not reach into the router. Call an application use case instead.',
  },
]

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'private/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error',
    },
  },

  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: DOMAIN_FORBIDDEN }] },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: APPLICATION_FORBIDDEN }] },
  },
  {
    files: ['src/router/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ROUTER_FORBIDDEN }] },
  },
  {
    files: ['src/adapters/mcp/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: MCP_ADAPTER_FORBIDDEN }] },
  },

  {
    files: ['src/bootstrap/**/*.ts', 'src/adapters/cli/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['tests/**/*.ts', 'evals/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },

  {
    files: ['*.config.js', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
)
