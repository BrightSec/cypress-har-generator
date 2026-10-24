import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // ts-jest rewrites the `.ts` import extensions to `.js`
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
