import pkg from '../../package.json' with { type: 'json' };
import type { Entry, Har } from 'har-format';

export class HarBuilder {
  constructor(private readonly entries: Entry[]) {}

  public build(): Har {
    const { name, version, homepage: comment } = pkg;

    return {
      log: {
        version: '1.2',
        pages: [],
        creator: {
          name,
          version,
          comment
        },
        // Entries are recorded as requests finish; HAR 1.2 orders them by start time.
        entries: this.entries
          .slice()
          .sort(
            (a, b) =>
              Date.parse(a.startedDateTime) - Date.parse(b.startedDateTime)
          )
      }
    };
  }
}
