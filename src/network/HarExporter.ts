import type { NetworkRequest } from './NetworkRequest.ts';
import type { Page } from 'har-format';

export interface ExportedEntry {
  // as `HarBuilder.formatEntry` serializes it
  json: string;
  pageref?: string;
  startedAt: number;
}

export interface HarExport {
  pages: Page[];
  entries: AsyncIterable<ExportedEntry>;
}

export interface HarExporter {
  read(): Promise<HarExport | undefined>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
