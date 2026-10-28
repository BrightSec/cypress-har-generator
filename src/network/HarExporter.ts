import type { NetworkRequest } from './NetworkRequest.ts';
import type { HarTest, TestTimeline } from './TestTimeline.ts';
import type { Page } from 'har-format';

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
  read(tests?: TestTimeline): Promise<HarExport | undefined>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
