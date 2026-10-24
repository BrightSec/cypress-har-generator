import type { Entry, Har } from 'har-format';

export class HarBuilder {
  constructor(private readonly entries: Entry[]) {}

  public build(): Har {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { name, version, homepage: comment } = require('../../package.json');

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
