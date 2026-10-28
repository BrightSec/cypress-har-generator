import { HarBuilder } from './HarBuilder.ts';
import type { ExportedEntry } from './HarExporter.ts';
import type { Entry } from 'har-format';
import { describe, beforeEach, it, expect } from '@jest/globals';

const entries: Entry[] = [
  {
    startedDateTime: '2022-04-18T09:09:35.585Z',
    time: -1,
    request: {
      method: 'GET',
      url: 'https://example.com/',
      httpVersion: 'HTTP/0.9',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'HTTP/0.9',
      headers: [],
      cookies: [],
      content: {
        size: -1,
        mimeType: 'text/plain'
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1
    },
    cache: {},
    timings: { send: 0, receive: 0, wait: 0 }
  }
];

const entriesOf = async function* (
  items: Entry[],
  refs: Omit<ExportedEntry, 'json'> = {}
): AsyncGenerator<ExportedEntry> {
  for (const item of items) {
    yield await Promise.resolve({
      json: HarBuilder.formatEntry(item),
      ...refs
    });
  }
};

const read = async (chunks: AsyncIterable<string>): Promise<string> => {
  let result = '';
  for await (const chunk of chunks) {
    result += chunk;
  }

  return result;
};

describe('HarBuilder', () => {
  let pkg!: { name: string; version: string; homepage: string };

  beforeEach(async () => {
    pkg = (await import('../../package.json', { with: { type: 'json' } }))
      .default;
  });

  describe('build', () => {
    it('should return an HAR', async () => {
      // arrange
      const { name, version, homepage: comment } = pkg;
      // act
      const result = await read(new HarBuilder(entriesOf(entries)).build());
      // assert
      expect(JSON.parse(result)).toEqual({
        log: {
          entries,
          version: '1.2',
          pages: [],
          creator: {
            name,
            version,
            comment
          }
        }
      });
    });

    it('should write the pages and add the page to each entry as its first field', async () => {
      // arrange
      const pages = [
        {
          startedDateTime: '2022-04-18T09:09:35.585Z',
          id: 'page_1',
          title: 'https://example.com/',
          pageTimings: {}
        }
      ];
      // act
      const result = await read(
        new HarBuilder(entriesOf(entries, { pageref: 'page_1' }), pages).build()
      );
      // assert
      const { log } = JSON.parse(result);
      expect(log.pages).toEqual(pages);
      expect(log.entries).toEqual([{ pageref: 'page_1', ...entries[0] }]);
      expect(Object.keys(log.entries[0])[0]).toBe('pageref');
    });

    it('should list the tests after the pages and add the test of each entry after its page, as the whole HAR serialized at once would', async () => {
      // arrange
      const { name, version, homepage: comment } = pkg;
      const tests = [
        {
          startedDateTime: entries[0].startedDateTime,
          id: 'test_1',
          titlePath: ['suite', 'test'],
          attempt: 2
        }
      ];
      const expected = JSON.stringify(
        {
          log: {
            version: '1.2',
            pages: [],
            _tests: tests,
            creator: { name, version, comment },
            entries: [{ pageref: 'page_1', _testref: 'test_1', ...entries[0] }]
          }
        },
        null,
        2
      );
      // act
      const result = await read(
        new HarBuilder(
          entriesOf(entries, { pageref: 'page_1', testref: 'test_1' }),
          [],
          tests
        ).build()
      );
      // assert
      expect(result).toBe(expected);
    });

    it('should leave out the tests when no entry has one', async () => {
      // act
      const result = await read(new HarBuilder(entriesOf(entries)).build());
      // assert
      const { log } = JSON.parse(result);
      expect(log).not.toHaveProperty('_tests');
      expect(log.entries[0]).not.toHaveProperty('_testref');
    });

    it('should write the same text as the whole HAR serialized at once when the entries have pages', async () => {
      // arrange
      const { name, version, homepage: comment } = pkg;
      const pages = [
        {
          startedDateTime: '2022-04-18T09:09:35.585Z',
          id: 'page_1',
          title: 'https://example.com/[]',
          pageTimings: {}
        }
      ];
      const expected = JSON.stringify(
        {
          log: {
            version: '1.2',
            pages,
            creator: { name, version, comment },
            entries: [{ pageref: 'page_1', ...entries[0] }]
          }
        },
        null,
        2
      );
      // act
      const result = await read(
        new HarBuilder(entriesOf(entries, { pageref: 'page_1' }), pages).build()
      );
      // assert
      expect(result).toBe(expected);
    });

    it.each([0, 1, 3])(
      'should write the same text as the whole HAR serialized at once (%i entries)',
      async (count: number) => {
        // arrange
        const { name, version, homepage: comment } = pkg;
        const items: Entry[] = Array.from({ length: count }, (_, idx) => ({
          ...entries[0],
          request: { ...entries[0].request, url: `https://example.com/${idx}` }
        }));
        const expected = JSON.stringify(
          {
            log: {
              version: '1.2',
              pages: [],
              creator: { name, version, comment },
              entries: items
            }
          },
          null,
          2
        );
        // act
        const result = await read(new HarBuilder(entriesOf(items)).build());
        // assert
        expect(result).toBe(expected);
      }
    );
  });
});
