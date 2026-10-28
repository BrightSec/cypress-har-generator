export interface HarTest {
  titlePath: string[];
  // 1 for the first try, counting the retries
  attempt: number;
}

export interface TestStart extends HarTest {
  // the spec, as `Cypress.spec.relative`, so the tests of an earlier spec are dropped
  spec: string;
  startedAt: number;
}

/**
 * The tests of the spec in the order they started, so each entry can tell the test that sent it.
 */
export class HarTests {
  private spec?: string;
  private starts: TestStart[] = [];

  /**
   * Adds a test from the payload the page sends as it starts, ignoring a payload the commands would not send,
   * since the page of the app can call the same function.
   */
  public start(payload: string): void {
    const start: TestStart | undefined = this.parse(payload);

    if (!start) {
      return;
    }

    if (start.spec !== this.spec) {
      this.spec = start.spec;
      this.starts = [];
    }

    this.starts.push(start);
    // a test starts after the previous one, unless the clock of the page was set back
    this.starts.sort(
      (a: TestStart, b: TestStart): number => a.startedAt - b.startedAt
    );
  }

  /**
   * The test that was running at the given time: the last one that started by then.
   */
  public at(time: number): HarTest | undefined {
    let low = 0;
    let high: number = this.starts.length - 1;
    let found: TestStart | undefined;

    while (low <= high) {
      const middle: number = Math.floor((low + high) / 2);

      if (this.starts[middle].startedAt <= time) {
        found = this.starts[middle];
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return found
      ? { titlePath: found.titlePath, attempt: found.attempt }
      : undefined;
  }

  private parse(payload: string): TestStart | undefined {
    try {
      const { spec, titlePath, attempt, startedAt } = JSON.parse(payload);

      if (
        typeof spec === 'string' &&
        Array.isArray(titlePath) &&
        titlePath.every((x: unknown): boolean => typeof x === 'string') &&
        Number.isInteger(attempt) &&
        attempt > 0 &&
        Number.isFinite(startedAt)
      ) {
        return { spec, titlePath, attempt, startedAt };
      }
    } catch {
      // not a JSON
    }

    return undefined;
  }
}
