import { HarRouter } from './HarRouter.ts';
import type { Entry } from 'har-format';
import { describe, expect, it } from '@jest/globals';

const createEntry = (
  url: string,
  {
    method = 'GET',
    postData,
    resourceType,
    status = 200
  }: {
    method?: string;
    postData?: string;
    resourceType?: string;
    status?: number;
  } = {}
): Entry =>
  ({
    _resourceType: resourceType,
    request: {
      method,
      url,
      ...(postData === undefined
        ? {}
        : { postData: { mimeType: 'application/json', text: postData } })
    },
    response: { status }
  }) as unknown as Entry;

describe('HarRouter', () => {
  it('should find the entry with the same method and URL', () => {
    // arrange
    const entry = createEntry('https://example.com/api?id=1', {
      method: 'DELETE'
    });
    const router = new HarRouter([
      createEntry('https://example.com/api?id=1'),
      createEntry('https://example.com/api?id=2', { method: 'DELETE' }),
      entry
    ]);

    // act
    const result = router.find({
      method: 'delete',
      url: 'https://example.com/api?id=1'
    });

    // assert
    expect(result).toBe(entry);
  });

  it('should ignore the fragment of the URL', () => {
    // arrange
    const entry = createEntry('https://example.com/page');
    const router = new HarRouter([entry]);

    // act
    const result = router.find({
      method: 'GET',
      url: 'https://example.com/page#top'
    });

    // assert
    expect(result).toBe(entry);
  });

  it('should return nothing when no entry matches', () => {
    // arrange
    const router = new HarRouter([createEntry('https://example.com/a')]);

    // act
    const result = router.find({ method: 'GET', url: 'https://example.com/b' });

    // assert
    expect(result).toBeUndefined();
  });

  it.each([
    { body: { a: 1, b: [2] } },
    { body: '{ "a": 1, "b": [2] }' },
    { body: new TextEncoder().encode('{"a":1,"b":[2]}').buffer }
  ])('should match the body $body to the recorded one', ({ body }) => {
    // arrange
    const entry = createEntry('https://example.com/api', {
      method: 'POST',
      postData: '{"a":1,"b":[2]}'
    });
    const router = new HarRouter([
      createEntry('https://example.com/api', {
        method: 'POST',
        postData: '{"a":2}'
      }),
      entry
    ]);

    // act
    const result = router.find({
      method: 'POST',
      url: 'https://example.com/api',
      body
    });

    // assert
    expect(result).toBe(entry);
  });

  it('should match a request without a body only to an entry without one', () => {
    // arrange
    const entry = createEntry('https://example.com/api', { method: 'POST' });
    const router = new HarRouter([
      createEntry('https://example.com/api', {
        method: 'POST',
        postData: 'text'
      }),
      entry
    ]);

    // act
    const result = router.find({
      method: 'POST',
      url: 'https://example.com/api',
      body: ''
    });

    // assert
    expect(result).toBe(entry);
  });

  it('should return nothing when the body differs', () => {
    // arrange
    const router = new HarRouter([
      createEntry('https://example.com/api', {
        method: 'POST',
        postData: 'text'
      })
    ]);

    // act
    const result = router.find({
      method: 'POST',
      url: 'https://example.com/api',
      body: 'other'
    });

    // assert
    expect(result).toBeUndefined();
  });

  it('should serve the repeated entries in order, then the last one', () => {
    // arrange
    const first = createEntry('https://example.com/api', { status: 201 });
    const second = createEntry('https://example.com/api', { status: 202 });
    const router = new HarRouter([first, second]);
    const request = { method: 'GET', url: 'https://example.com/api' };

    // act
    const result = [
      router.find(request),
      router.find(request),
      router.find(request)
    ];

    // assert
    expect(result).toEqual([first, second, second]);
  });

  it.each([
    { url: 'ws://example.com/ws', resourceType: 'WebSocket' },
    { url: 'https://example.com/ws', resourceType: 'WebSocket' },
    { url: 'https://example.com/events', resourceType: 'EventSource' },
    { url: 'data:text/plain,hello' },
    { url: 'blob:https://example.com/3f1f7e0b' },
    { url: 'not a URL' }
  ])('should not serve $url ($resourceType)', ({ url, resourceType }) => {
    // arrange
    const router = new HarRouter([createEntry(url, { resourceType })]);

    // act
    const result = router.find({ method: 'GET', url });

    // assert
    expect(result).toBeUndefined();
  });
});
