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

  // Per-path thresholds for router/**, infrastructure/filesystem/** and
  // infrastructure/manifest/** (95/95/95/90) are added in the phase that
  // creates each directory; Jest fails when a threshold path matches no file.
  coverageThreshold: {
    global: {
      statements: 90,
      lines: 90,
      functions: 90,
      branches: 85,
    },
  },

  clearMocks: true,
  restoreMocks: true,
}
