/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],

  // TypeScript sources import siblings with an explicit `.js` extension (NodeNext).
  // Jest resolves from the pre-compilation tree, so that extension must be stripped.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },

  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],

  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    // Type-only modules: they compile to an empty module and can hold no
    // coverage, so measuring them only makes the report misleading.
    '!src/application/ports/**',
    '!src/domain/skill/skill-match.ts',
    '!src/bootstrap/start-stdio.ts',
    '!src/bootstrap/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],

  coverageThreshold: {
    global: {
      statements: 90,
      lines: 90,
      functions: 90,
      branches: 85,
    },
    // Critical code carries a stricter bar: ranking, parsing untrusted
    // manifests, containing paths, and deciding skill identities.
    './src/router/': {
      statements: 95,
      lines: 95,
      functions: 95,
      branches: 90,
    },
    './src/infrastructure/manifest/': {
      statements: 95,
      lines: 95,
      functions: 95,
      branches: 90,
    },
    './src/infrastructure/filesystem/': {
      statements: 95,
      lines: 95,
      functions: 95,
      branches: 90,
    },
    './src/infrastructure/registry/': {
      statements: 95,
      lines: 95,
      functions: 95,
      branches: 90,
    },
  },

  clearMocks: true,
  restoreMocks: true,
}
