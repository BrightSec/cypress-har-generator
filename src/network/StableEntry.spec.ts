import { StableEntry } from './StableEntry.ts';
import type { Entry } from 'har-format';
import { describe, expect, it } from '@jest/globals';

describe('StableEntry', () => {
  const entry = {
    startedDateTime: '2026-10-28T10:00:00.123Z',
    time: 42.5,
    connection: '123',
    serverIPAddress: '127.0.0.1',
    request: {
      method: 'GET',
      url: 'https://example.com/',
      httpVersion: 'HTTP/1.1',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: 0
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'Date', value: 'Wed, 28 Oct 2026 10:00:00 GMT' }],
      cookies: [],
      content: { size: 2, mimeType: 'text/plain', text: 'ok' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 2
    },
    cache: {},
    timings: {
      blocked: 1,
      dns: 2,
      connect: 3,
      ssl: 4,
      send: 5,
      wait: 6,
      receive: 7,
      _workerStart: 8
    }
  } as Entry;

  describe('toEntry', () => {
    it('should replace the times with the values used when timing is omitted', () => {
      // act
      const result = new StableEntry(entry).toEntry();

      // assert
      expect(result).toMatchObject({
        startedDateTime: '1970-01-01T00:00:00.000Z',
        time: -1
      });
      expect(result.timings).toEqual({ send: -1, wait: -1, receive: -1 });
    });

    it('should keep the comment of the timings', () => {
      // act
      const result = new StableEntry({
        ...entry,
        timings: { ...entry.timings, comment: 'note' }
      }).toEntry();

      // assert
      expect(result.timings).toEqual({
        send: -1,
        wait: -1,
        receive: -1,
        comment: 'note'
      });
    });

    it('should remove the connection', () => {
      // act
      const result = new StableEntry(entry).toEntry();

      // assert
      expect(result).not.toHaveProperty('connection');
    });

    it('should keep the request, the response and the other fields', () => {
      // act
      const result = new StableEntry(entry).toEntry();

      // assert
      expect(result).toMatchObject({
        serverIPAddress: entry.serverIPAddress,
        request: entry.request,
        response: entry.response,
        cache: entry.cache
      });
    });

    it.each(['_webSocketMessages', '_eventSourceMessages'] as const)(
      'should replace the times of %s',
      field => {
        // act
        const result = new StableEntry({
          ...entry,
          [field]: [{ type: 'receive', time: 1761645600.5, data: 'ok' }]
        }).toEntry();

        // assert
        expect(result[field]).toEqual([
          { type: 'receive', time: -1, data: 'ok' }
        ]);
      }
    );

    it('should not change the given entry', () => {
      // arrange
      const copy = structuredClone(entry);

      // act
      new StableEntry(entry).toEntry();

      // assert
      expect(entry).toEqual(copy);
    });
  });
});
