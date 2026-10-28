/// <reference types="node" preserve="true" />
import { EntryBuilder } from './EntryBuilder.ts';
import { HarBuilder } from './HarBuilder.ts';
import { StableEntry } from './StableEntry.ts';
import type { NetworkRequest } from './NetworkRequest.ts';
import type { ExportedEntry, HarExport, HarExporter } from './HarExporter.ts';
import { HarPages } from './HarPages.ts';
import { TestTimeline } from './TestTimeline.ts';
import { STABLE_STARTED_DATE_TIME } from '../constants.ts';
import type { Logger } from '../utils/Logger.ts';
import { ErrorUtils } from '../utils/ErrorUtils.ts';
import type {
  DefaultHarExporterOptions,
  Filter,
  Transformer
} from './DefaultHarExporterOptions.ts';
import type { Entry } from 'har-format';
import type { WriteStream } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { format } from 'node:util';

interface Slot {
  position: number;
  length: number;
  startedAt: number;
  // the loader of the document that sent the request, unless the `transform` set the page itself
  loaderId?: string;
  // the `transform` set the test itself
  hasTestref?: true;
}

export class DefaultHarExporter implements HarExporter {
  private get filter(): Filter | undefined {
    return this.options?.filter;
  }

  private get transform(): Transformer | undefined {
    return this.options?.transform;
  }

  private readonly buffer: WriteStream;
  private readonly pendingWrites = new Set<Promise<void>>();
  // Where each entry is in the file, so the HAR is built by reading one entry at a time.
  private readonly index: Slot[] = [];
  // where in `index` each request written so far is, when `dedupe` is set
  private readonly slots = new Map<string, number>();
  private readonly pages = new HarPages();
  private size = 0;
  private invalidTransformResultReported = false;

  constructor(
    private readonly logger: Logger,
    private readonly file: FileHandle,
    private readonly options?: DefaultHarExporterOptions
  ) {
    this.buffer = file.createWriteStream({ encoding: 'utf-8' });
  }

  public async read(
    tests: TestTimeline = new TestTimeline()
  ): Promise<HarExport | undefined> {
    await Promise.allSettled(this.pendingWrites);

    if (!this.index.length) {
      return undefined;
    }

    // Entries are recorded as requests finish; HAR 1.2 orders them by start time.
    const entries = this.index
      .slice()
      .sort((a, b) => a.startedAt - b.startedAt);

    const stamp = this.options?.stable
      ? { startedDateTime: STABLE_STARTED_DATE_TIME }
      : {};
    const selected: TestTimeline = tests.select(
      entries.map(({ startedAt }: Slot): number => startedAt)
    );

    return {
      pages: this.pages.toArray(stamp),
      tests: selected.toArray(stamp),
      entries: this.readEntries(entries, selected)
    };
  }

  public async write(networkRequest: NetworkRequest): Promise<void> {
    const pending = this.writeEntry(networkRequest);

    this.pendingWrites.add(pending);

    try {
      await pending;
    } finally {
      this.pendingWrites.delete(pending);
    }
  }

  public end(): void {
    this.buffer.end();
  }

  private async *readEntries(
    entries: Slot[],
    tests: TestTimeline
  ): AsyncGenerator<ExportedEntry> {
    for (const {
      position,
      length,
      loaderId,
      startedAt,
      hasTestref
    } of entries) {
      const { buffer, bytesRead } = await this.file.read(
        Buffer.alloc(length),
        0,
        length,
        position
      );
      // the page is known only once every document is written, so it is added as the entry is read
      yield {
        json: buffer.toString('utf-8', 0, bytesRead),
        pageref: loaderId ? this.pages.idOf(loaderId) : undefined,
        testref: hasTestref ? undefined : tests.idAt(startedAt)
      };
    }
  }

  private async transformEntry(entry: Entry): Promise<Entry | undefined> {
    try {
      const result =
        typeof this.transform === 'function'
          ? await this.transform(entry)
          : entry;

      if (typeof result !== 'object' || result === null) {
        this.warnAboutInvalidTransformResult(result);

        return undefined;
      }

      return result;
    } catch (e) {
      const stack = ErrorUtils.isError(e) ? e.stack : e;

      this.logger.debug(
        format(`The entry has been filtered out due to an error: %j`, entry)
      );
      this.logger.err(
        `The entry is missing as a result of an error in the 'transform' function.

The stack trace for this error is:
${stack}`
      );

      return undefined;
    }
  }

  private async writeEntry(networkRequest: NetworkRequest): Promise<void> {
    const entry = await new EntryBuilder(networkRequest).build();

    if (await this.applyFilter(entry)) {
      return;
    }

    const result = await this.transformEntry(entry);

    if (!this.buffer.writable || !result) {
      return;
    }

    const startedAt = Date.parse(result.startedDateTime);
    const key: string | undefined = this.dedupeKeyOf(result);
    const kept: number | undefined = key ? this.slots.get(key) : undefined;

    // requests finish in any order, so a request that started earlier can be written after its repeat
    if (kept !== undefined && this.index[kept].startedAt <= startedAt) {
      return;
    }

    // the slot is set before awaiting the write, so a repeat finishing meanwhile sees where this entry is
    const { written, ...location } = this.append(result);
    const slot: Slot = {
      startedAt,
      ...location,
      ...('pageref' in result ? {} : { loaderId: networkRequest.loaderId }),
      ...('_testref' in result ? { hasTestref: true as const } : {})
    };

    this.store(slot, kept, key);
    await this.addDocument(networkRequest, startedAt);
    await written;
  }

  private store(slot: Slot, kept?: number, key?: string): void {
    if (kept !== undefined) {
      this.index[kept] = slot;

      return;
    }

    this.index.push(slot);

    if (key) {
      this.slots.set(key, this.index.length - 1);
    }
  }

  private async addDocument(
    { frameAncestors, frameId, loaderId, url }: NetworkRequest,
    startedAt: number
  ): Promise<void> {
    const ancestors: string[] | undefined = await frameAncestors;

    if (ancestors) {
      this.pages.add({ ancestors, frameId, loaderId, startedAt, url });
    }
  }

  private append(
    entry: Entry
  ): Pick<Slot, 'position' | 'length'> & { written: Promise<void> } {
    // the real start time still orders the entries, as only the written entry leaves it out
    const json = HarBuilder.formatEntry(
      this.options?.stable ? new StableEntry(entry).toEntry() : entry
    );
    const length = Buffer.byteLength(json);
    // the stream appends the chunks in the order they are written
    const position = this.size;

    this.size += length;

    return {
      position,
      length,
      written: new Promise<void>((resolve, reject) =>
        this.buffer.write(json, e => (e ? reject(e) : resolve()))
      )
    };
  }

  private dedupeKeyOf({
    request,
    _webSocketMessages,
    _eventSourceMessages
  }: Entry): string | undefined {
    const hasMessages: boolean = [
      _webSocketMessages,
      _eventSourceMessages
    ].some(
      (messages: unknown): boolean =>
        Array.isArray(messages) && messages.length > 0
    );

    if (!this.options?.dedupe || hasMessages) {
      return undefined;
    }

    return JSON.stringify([
      request.method,
      request.url,
      request.postData?.mimeType,
      request.postData?.text
    ]);
  }

  private warnAboutInvalidTransformResult(result: unknown): void {
    if (this.invalidTransformResultReported) {
      return;
    }

    this.invalidTransformResultReported = true;
    this.logger.warn(
      `The 'transform' function in '${this.options?.transformPath}' returned ${format('%o', result)} instead of an entry, so such entries are left out of the HAR. The function must return the entry (e.g. \`return entry;\`).`
    );
  }

  private async applyFilter(entry: Entry): Promise<unknown> {
    try {
      return typeof this.filter === 'function' && (await this.filter(entry));
    } catch (e) {
      const message = ErrorUtils.isError(e) ? e.message : e;

      this.logger.debug(
        `The operation has encountered an error while processing the entry. ${message}`
      );

      return false;
    }
  }
}
