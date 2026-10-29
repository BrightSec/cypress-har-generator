import type { TestStart } from './TestStart.ts';
import { StartOrder } from './StartOrder.ts';

export type TestAttempt = Pick<TestStart, 'titlePath' | 'attempt'>;

/**
 * Tells whether the entries a test sent belong in the HAR.
 */
export type TestFilter = (test: TestAttempt) => boolean;

/**
 * The state of a try once it ended, e.g. `passed` or `failed`, or `undefined` when it is not known.
 */
export type TestStateLookup = (test: TestAttempt) => string | undefined;

export interface HarTest {
  startedDateTime: string;
  id: string;
  titlePath: string[];
  attempt: number;
  state?: string;
}

interface TestTimelineOptions {
  keep?: TestFilter;
  stateOf?: TestStateLookup;
}

/**
 * The tests in the order they started, so each entry can tell the test that was running as it started.
 */
export class TestTimeline {
  private readonly starts: StartOrder<TestStart>;

  constructor(
    starts: Iterable<TestStart> = [],
    private readonly options: TestTimelineOptions = {}
  ) {
    this.starts = new StartOrder(starts);
  }

  /**
   * The same tests, keeping only the entries sent by the ones the filter accepts.
   */
  public only(keep: TestFilter): TestTimeline {
    return new TestTimeline(this.starts.items, { ...this.options, keep });
  }

  /**
   * The same tests, each listed with the state its try ended in.
   */
  public withStates(stateOf: TestStateLookup): TestTimeline {
    return new TestTimeline(this.starts.items, { ...this.options, stateOf });
  }

  /**
   * Whether an entry that started at the given time is kept: always, unless only some tests are kept,
   * so an entry sent before the first test is then left out.
   */
  public keeps(time: number): boolean {
    const { keep } = this.options;

    if (!keep) {
      return true;
    }

    const test: TestStart | undefined = this.testAt(time);

    return !!test && keep(test);
  }

  /**
   * The tests that were running at the given times, as the start times of the entries,
   * so a test that sent nothing to the HAR is left out of it.
   */
  public select(times: Iterable<number>): TestTimeline {
    const selected = new Set<number>();

    for (const time of times) {
      const index: number = this.starts.indexAt(time);

      if (index >= 0) {
        selected.add(index);
      }
    }

    return new TestTimeline(
      this.starts.items.filter((_: TestStart, index: number): boolean =>
        selected.has(index)
      ),
      { stateOf: this.options.stateOf }
    );
  }

  /**
   * The ID of the test that was running at the given time: the last one that started by then.
   */
  public idAt(time: number): string | undefined {
    const index: number = this.starts.indexAt(time);

    return index >= 0 ? this.idOf(index) : undefined;
  }

  public toArray({
    startedDateTime
  }: { startedDateTime?: string } = {}): HarTest[] {
    return this.starts.items.map(
      (
        { titlePath, attempt, startedAt }: TestStart,
        index: number
      ): HarTest => {
        const state: string | undefined = this.options.stateOf?.({
          titlePath,
          attempt
        });

        return {
          startedDateTime: startedDateTime ?? new Date(startedAt).toISOString(),
          id: this.idOf(index),
          titlePath,
          attempt,
          ...(state ? { state } : {})
        };
      }
    );
  }

  private testAt(time: number): TestStart | undefined {
    const index: number = this.starts.indexAt(time);

    return index >= 0 ? this.starts.items[index] : undefined;
  }

  private idOf(index: number): string {
    return `test_${index + 1}`;
  }
}
