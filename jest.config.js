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
    // Parsing untrusted manifests is critical code and carries a stricter bar.
    // Thresholds for router/** and infrastructure/filesystem/** are added in
    // the phase that creates them: Jest fails when a path matches no file.
    './src/infrastructure/manifest/': {
      statements: 95,
      lines: 95,
      functions: 95,
      branches: 90,
    },
  },

  clearMocks: true,
  restoreMocks: true,
}
