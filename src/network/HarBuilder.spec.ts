import { HarBuilder } from './HarBuilder.ts';
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

describe('HarBuilder', () => {
  let builder: HarBuilder;

  beforeEach(() => {
    builder = new HarBuilder(entries);
  });

  describe('build', () => {
    it('should return an HAR', async () => {
      // arrange
      const {
        name,
        version,
        homepage: comment
      } = (await import('../../package.json', { with: { type: 'json' } }))
        .default;
      // act
      const result = builder.build();
      // assert
      expect(result).toMatchObject({
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

    it('should sort entries by startedDateTime, keeping the order of entries started at the same time', () => {
      // arrange
      const entry: Entry = entries[0];
      const at = (startedDateTime: string, url: string): Entry => ({
        ...entry,
        startedDateTime,
        request: { ...entry.request, url }
      });
      const unsorted: Entry[] = [
        at('2022-04-18T09:09:35.705Z', 'https://example.com/logo.png'),
        at('2022-04-18T09:09:35.704Z', 'https://example.com/style.css'),
        at('2022-04-18T09:09:35.705Z', 'https://example.com/app.js'),
        at('2022-04-18T09:09:35.585Z', 'https://example.com/')
      ];
      // act
      const result = new HarBuilder(unsorted).build();
      // assert
      expect(result.log.entries.map(x => x.request.url)).toEqual([
        'https://example.com/',
        'https://example.com/style.css',
        'https://example.com/logo.png',
        'https://example.com/app.js'
      ]);
    });
  });
});
