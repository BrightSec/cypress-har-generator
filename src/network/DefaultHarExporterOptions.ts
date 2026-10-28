import type { Entry } from 'har-format';

export type Filter = (entry: Entry) => Promise<unknown> | unknown;
export type Transformer = (entry: Entry) => Promise<Entry> | Entry;

export interface DefaultHarExporterOptions {
  filter?: Filter;
  transform?: Transformer;
  transformPath?: string;
  dedupe?: boolean;
}
