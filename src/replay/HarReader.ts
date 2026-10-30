import type { FileManager } from '../utils/FileManager.ts';
import type { RecordedHar } from './RecordedHar.ts';

export class HarReader {
  constructor(private readonly fileManager: FileManager) {}

  public async read(path: string): Promise<RecordedHar> {
    let data: string;

    try {
      data = await this.fileManager.readFile(path);
    } catch (e) {
      throw new Error(`Failed to read the HAR file at ${path}.`, {
        cause: e
      });
    }

    let har: { log?: { entries?: unknown; _tests?: unknown } } | undefined;

    try {
      har = JSON.parse(data);
    } catch (e) {
      throw new TypeError(`The file at ${path} is not a valid JSON.`, {
        cause: e
      });
    }

    const { entries, _tests: tests = [] } = har?.log ?? {};

    if (!Array.isArray(entries)) {
      throw new TypeError(
        `The file at ${path} is not a HAR file: it has no \`log.entries\` array.`
      );
    }

    if (!Array.isArray(tests)) {
      throw new TypeError(
        `The file at ${path} is not a HAR file: its \`log._tests\` is not an array.`
      );
    }

    return { entries, tests };
  }
}
