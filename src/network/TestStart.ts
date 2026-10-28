// what the commands send to the plugin as each test starts
export interface TestStart {
  titlePath: string[];
  // 1 for the first try, counting the retries
  attempt: number;
  // the spec, as `Cypress.spec.relative`, so the tests of an earlier spec are dropped
  spec: string;
  startedAt: number;
}
