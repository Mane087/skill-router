/**
 * Evaluations run separately from the test suite.
 *
 * A system can pass every unit test and still retrieve the wrong skills, so
 * these two answer different questions and fail for different reasons.
 */
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  roots: ['<rootDir>/evals'],
  testMatch: ['**/*.eval.ts'],
  collectCoverage: false,
}
