import pkg from '../../package.json' with { type: 'json' };
import type { Har } from 'har-format';

// An entry sits three levels deep, at `log.entries[i]`.
const ENTRY_INDENT = ' '.repeat(6);

export class HarBuilder {
  constructor(private readonly entries: AsyncIterable<string>) {}

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
      const indented = JSON.stringify(JSON.parse(entry), null, 2).replaceAll(
        '\n',
        `\n${ENTRY_INDENT}`
      );

      yield `${separator}\n${ENTRY_INDENT}${indented}`;
      separator = ',';
    }

    yield separator
      ? `\n${ENTRY_INDENT.slice(2)}${json.slice(entriesStart)}`
      : json.slice(entriesStart);
  }
}
