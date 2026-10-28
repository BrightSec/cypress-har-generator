import type { TestStart } from './TestStart.ts';
import { TestTimeline } from './TestTimeline.ts';
import { StartOrder } from './StartOrder.ts';

/**
 * Collects the tests of the current spec from the payloads the pages send as each test starts.
 */
export class HarTests {
  private spec?: string;
  private starts = new StartOrder<TestStart>();

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
      this.starts = new StartOrder();
    }

    // a test starts after the previous one, unless the clock of the page was set back
    this.starts.insert(start);
  }

  public timeline(): TestTimeline {
    return new TestTimeline(this.starts.items);
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
