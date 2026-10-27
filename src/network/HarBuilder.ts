import pkg from '../../package.json' with { type: 'json' };
import type { Entry, Har } from 'har-format';

// An entry sits three levels deep, at `log.entries[i]`.
const ENTRY_INDENT = ' '.repeat(6);

export class HarBuilder {
  constructor(private readonly entries: AsyncIterable<string>) {}

  // Serializes an entry the way it reads inside the HAR, so `build` writes it as is.
  public static formatEntry(entry: Entry): string {
    return JSON.stringify(entry, null, 2).replaceAll('\n', `\n${ENTRY_INDENT}`);
  }

  // Yields the HAR in chunks, holding a single entry in memory at a time.
  public async *build(): AsyncGenerator<string> {
    const { name, version, homepage: comment } = pkg;
    const har: Har = {
      log: {
        version: '1.2',
        pages: [],
        creator: {
          name,
          version,
          comment
        },
        entries: []
      }
    };
    const json = JSON.stringify(har, null, 2);
    const entriesStart = json.lastIndexOf('[]') + 1;
    let separator = '';

    yield json.slice(0, entriesStart);

    for await (const entry of this.entries) {
      yield `${separator}\n${ENTRY_INDENT}${entry}`;
      separator = ',';
    }

    yield separator
      ? `\n${ENTRY_INDENT.slice(2)}${json.slice(entriesStart)}`
      : json.slice(entriesStart);
  }
}
