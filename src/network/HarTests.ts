export interface HarTest {
  startedDateTime: string;
  id: string;
  titlePath: string[];
  // 1 for the first try, counting the retries
  attempt: number;
}

export interface TestStart {
  titlePath: string[];
  attempt: number;
  // the spec, as `Cypress.spec.relative`, so the tests of an earlier spec are dropped
  spec: string;
  startedAt: number;
}

/**
 * The tests of the spec in the order they started, so each entry can tell the test that sent it.
 */
export class HarTests {
  private spec?: string;

  constructor(private starts: TestStart[] = []) {}

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
   * The tests that were running at the given times, as the start times of the entries,
   * so a test that sent nothing to the HAR is left out of it.
   */
  public select(times: Iterable<number>): HarTests {
    const selected = new Set<TestStart>();

    for (const time of times) {
      const index: number = this.indexAt(time);

      if (index >= 0) {
        selected.add(this.starts[index]);
      }
    }

    return new HarTests(
      this.starts.filter((start: TestStart): boolean => selected.has(start))
    );
  }

  /**
   * The ID of the test that was running at the given time: the last one that started by then.
   */
  public idAt(time: number): string | undefined {
    const index: number = this.indexAt(time);

    return index >= 0 ? this.idOf(index) : undefined;
  }

  public toArray({
    startedDateTime
  }: { startedDateTime?: string } = {}): HarTest[] {
    return this.starts.map(
      (
        { titlePath, attempt, startedAt }: TestStart,
        index: number
      ): HarTest => ({
        startedDateTime: startedDateTime ?? new Date(startedAt).toISOString(),
        id: this.idOf(index),
        titlePath,
        attempt
      })
    );
  }

  private idOf(index: number): string {
    return `test_${index + 1}`;
  }

  private indexAt(time: number): number {
    let low = 0;
    let high: number = this.starts.length - 1;
    let found = -1;

    while (low <= high) {
      const middle: number = Math.floor((low + high) / 2);

      if (this.starts[middle].startedAt <= time) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return found;
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
