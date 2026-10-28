import pkg from '../../package.json' with { type: 'json' };
import type { ExportedEntry } from './HarExporter.ts';
import type { HarTests } from './HarTests.ts';
import type { Entry, Har, Page } from 'har-format';

// An entry sits three levels deep, at `log.entries[i]`.
const ENTRY_INDENT = ' '.repeat(6);

export class HarBuilder {
  constructor(
    private readonly entries: AsyncIterable<ExportedEntry>,
    private readonly pages: Page[] = [],
    private readonly tests?: HarTests
  ) {}

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
        pages: this.pages,
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

    // the entry is yielded on its own, as joining it with the text around it would copy it
    for await (const { json: entry, pageref, startedAt } of this.entries) {
      // HAR 1.2 lists `pageref` first, right after the opening brace of the entry
      const fields: string = this.formatFields({
        pageref,
        _test: this.tests?.at(startedAt)
      });

      yield `${separator}\n${ENTRY_INDENT}`;

      if (fields) {
        yield `{${fields}`;
        yield entry.slice(1);
      } else {
        yield entry;
      }

      separator = ',';
    }

    yield separator
      ? `\n${ENTRY_INDENT.slice(2)}${json.slice(entriesStart)}`
      : json.slice(entriesStart);
  }

  // the fields known only once the HAR is read, as the lines that open the entry
  private formatFields(fields: Record<string, unknown>): string {
    return Object.entries(fields)
      .filter(([, value]: [string, unknown]): boolean => value !== undefined)
      .map(
        ([name, value]: [string, unknown]): string =>
          `\n${ENTRY_INDENT}  ${JSON.stringify(name)}: ${JSON.stringify(value, null, 2).replaceAll('\n', `\n${ENTRY_INDENT}  `)},`
      )
      .join('');
  }
}
