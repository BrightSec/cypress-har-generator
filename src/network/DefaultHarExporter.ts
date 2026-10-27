/// <reference types="node" preserve="true" />
import { EntryBuilder } from './EntryBuilder.ts';
import type { NetworkRequest } from './NetworkRequest.ts';
import type { HarExporter } from './HarExporter.ts';
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
import { EOL } from 'node:os';
import { format, promisify } from 'node:util';

export class DefaultHarExporter implements HarExporter {
  private get filter(): Filter | undefined {
    return this.options?.filter;
  }

  private get transform(): Transformer | undefined {
    return this.options?.transform;
  }

  private readonly buffer: WriteStream;
  private readonly pendingWrites = new Set<Promise<void>>();
  private invalidTransformResultReported = false;

  constructor(
    private readonly logger: Logger,
    private readonly file: FileHandle,
    private readonly options?: DefaultHarExporterOptions
  ) {
    this.buffer = file.createWriteStream({ encoding: 'utf-8' });
  }

  public async read(): Promise<string> {
    await Promise.allSettled(this.pendingWrites);

    const { size } = await this.file.stat();
    const { buffer, bytesRead } = await this.file.read(
      Buffer.alloc(size),
      0,
      size,
      0
    );

    return buffer.toString('utf-8', 0, bytesRead);
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

  public async serializeEntry(entry: Entry): Promise<string | undefined> {
    try {
      const result =
        typeof this.transform === 'function'
          ? await this.transform(entry)
          : entry;

      if (typeof result !== 'object' || result === null) {
        this.warnAboutInvalidTransformResult(result);

        return undefined;
      }

      return JSON.stringify(result);
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

  public end(): void {
    this.buffer.end();
  }

  private async writeEntry(networkRequest: NetworkRequest): Promise<void> {
    const entry = await new EntryBuilder(networkRequest).build();

    if (await this.applyFilter(entry)) {
      return;
    }

    const json = await this.serializeEntry(entry);

    if (this.buffer.writable && json) {
      // @ts-expect-error signature mismatch due to overloading issues
      await promisify(this.buffer.write).call(this.buffer, `${json}${EOL}`);
    }
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
