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
        entries: this.entries
      }
    };
  }
}
