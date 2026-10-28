import type { FileManager } from '../utils/FileManager.ts';
import { ErrorUtils } from '../utils/ErrorUtils.ts';
import type { Entry, Har } from 'har-format';

export class HarReader {
  constructor(private readonly fileManager: FileManager) {}

  public async read(path: string): Promise<Entry[]> {
    const data: string | undefined = await this.fileManager.readFile(path);

    if (data === undefined) {
      throw new Error(`Failed to read the HAR file at ${path}.`);
    }

    let har: Partial<Har> | undefined;

    try {
      har = JSON.parse(data);
    } catch (e) {
      throw new TypeError(
        `The file at ${path} is not a valid JSON: ${ErrorUtils.isError(e) ? e.message : e}`,
        { cause: e }
      );
    }

    const entries: unknown = har?.log?.entries;

    if (!Array.isArray(entries)) {
      throw new TypeError(
        `The file at ${path} is not a HAR file: it has no \`log.entries\` array.`
      );
    }

    return entries;
  }
}
