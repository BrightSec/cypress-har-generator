import type { TestStart } from './TestStart.ts';

export interface HarTest {
  startedDateTime: string;
  id: string;
  titlePath: string[];
  attempt: number;
}

/**
 * The tests in the order they started, so each entry can tell the test that was running as it started.
 */
export class TestTimeline {
  constructor(private readonly starts: readonly TestStart[] = []) {}

  /**
   * The tests that were running at the given times, as the start times of the entries,
   * so a test that sent nothing to the HAR is left out of it.
   */
  public select(times: Iterable<number>): TestTimeline {
    const selected = new Set<number>();

    for (const time of times) {
      const index: number = this.indexAt(time);

      if (index >= 0) {
        selected.add(index);
      }
    }

    return new TestTimeline(
      this.starts.filter((_: TestStart, index: number): boolean =>
        selected.has(index)
      )
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
}
