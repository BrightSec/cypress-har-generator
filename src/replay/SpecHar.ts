import { HarRouter } from './HarRouter.ts';
import type { RecordedHar } from './RecordedHar.ts';
import type { HarTest } from '../network/TestTimeline.ts';

/**
 * The HAR of a spec, which serves each test the entries it sent, so the tests can run in any order.
 */
export class SpecHar {
  // the tests the HAR does not name share one router, so each goes on from where the previous one stopped
  private shared?: HarRouter;

  constructor(private readonly har: RecordedHar) {}

  public routerFor(titlePath: readonly string[]): HarRouter {
    const test: HarTest | undefined = this.lastAttemptOf(titlePath);

    if (!test) {
      this.shared ??= new HarRouter(this.har.entries);

      return this.shared;
    }

    return new HarRouter(
      this.har.entries.filter(({ _testref }) => _testref === test.id)
    );
  }

  // a test is tried again only when the try before failed, so the last try is the one that ran to the end
  private lastAttemptOf(titlePath: readonly string[]): HarTest | undefined {
    let last: HarTest | undefined;

    for (const test of this.har.tests) {
      if (
        this.isSameTitle(test.titlePath, titlePath) &&
        test.attempt >= (last?.attempt ?? 0)
      ) {
        last = test;
      }
    }

    return last;
  }

  private isSameTitle(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((x, index) => x === b[index]);
  }
}
