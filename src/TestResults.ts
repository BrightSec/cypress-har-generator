/// <reference types="cypress" preserve="true" />
import type { TestAttempt } from './network/TestTimeline.ts';

/**
 * The state of each try of the tests in a spec, as Cypress reports them in the results of `after:spec`.
 */
export class TestResults {
  private readonly states = new Map<string, string>();

  constructor(results: readonly CypressCommandLine.TestResult[] = []) {
    for (const { title, attempts } of results) {
      attempts.forEach(({ state }, index: number) => {
        this.states.set(
          this.keyOf({ titlePath: title, attempt: index + 1 }),
          state
        );
      });
    }
  }

  public stateOf = (test: TestAttempt): string | undefined =>
    this.states.get(this.keyOf(test));

  public failed = (test: TestAttempt): boolean =>
    this.stateOf(test) === 'failed';

  private keyOf({ titlePath, attempt }: TestAttempt): string {
    return JSON.stringify([titlePath, attempt]);
  }
}
