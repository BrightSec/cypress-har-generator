import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // ts-jest rewrites the `.ts` import extensions to `.js`

    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: './tsconfig.json', isolatedModules: true, useESM: true }
    ]
  },
  maxWorkers: '25%',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  collectCoverageFrom: ['src/**/*.ts', '!**/index.ts']
};

export default config;
