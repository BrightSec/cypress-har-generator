/// <reference types="cypress" preserve="true" />
import type { TestStart } from './network/TestStart.ts';

type TestAttempt = Pick<TestStart, 'titlePath' | 'attempt'>;

/**
 * The tries of the tests that failed in a spec, as Cypress reports them in the results of `after:spec`.
 */
export class FailedTests {
  private readonly keys = new Set<string>();

  constructor(results: readonly CypressCommandLine.TestResult[] = []) {
    for (const { title, attempts } of results) {
      attempts.forEach(({ state }, index: number) => {
        if (state === 'failed') {
          this.keys.add(this.keyOf({ titlePath: title, attempt: index + 1 }));
        }
      });
    }
  }

  public includes = (test: TestAttempt): boolean =>
    this.keys.has(this.keyOf(test));

  private keyOf({ titlePath, attempt }: TestAttempt): string {
    return JSON.stringify([titlePath, attempt]);
  }
}
