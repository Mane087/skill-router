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
    // Ports are type-only contracts: they compile to an empty module.
    '!src/application/ports/**',
    '!src/bootstrap/start-stdio.ts',
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
    // Critical code carries a stricter bar: parsing untrusted manifests,
    // containing paths, and deciding skill identities. The router threshold is
    // added with the router: Jest fails when a path matches no file.
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
