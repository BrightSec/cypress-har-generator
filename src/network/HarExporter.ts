import type { NetworkRequest } from './NetworkRequest.ts';
import type { HarTest, TestTimeline } from './TestTimeline.ts';
import type { TestStart } from './TestStart.ts';
import type { Page } from 'har-format';

/**
 * Tells whether the entries a test sent belong in the HAR.
 */
export type TestFilter = (
  test: Pick<TestStart, 'titlePath' | 'attempt'>
) => boolean;

export interface ExportedEntry {
  // as `HarBuilder.formatEntry` serializes it
  json: string;
  pageref?: string;
  testref?: string;
}

export interface HarExport {
  pages: Page[];
  tests: HarTest[];
  entries: AsyncIterable<ExportedEntry>;
}

export interface HarExporter {
  /**
   * @param tests - The tests of the spec, which give each entry its test.
   * @param keep - Keeps only the entries sent by the tests it accepts, and the pages they belong to.
   */
  read(tests?: TestTimeline, keep?: TestFilter): Promise<HarExport | undefined>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
