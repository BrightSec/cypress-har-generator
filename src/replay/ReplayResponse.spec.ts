import { ReplayResponse } from './ReplayResponse.ts';
import type { Content, Header, Response } from 'har-format';
import { describe, expect, it } from '@jest/globals';

const createResponse = ({
  status = 200,
  headers = [],
  content = { size: 0, mimeType: 'text/plain' }
}: {
  status?: number;
  headers?: Header[];
  content?: Content;
} = {}): Response =>
  ({
    status,
    statusText: '',
    httpVersion: 'HTTP/1.1',
    headers,
    cookies: [],
    content,
    redirectURL: '',
    headersSize: -1,
    bodySize: -1
  }) as Response;

describe('ReplayResponse', () => {
  it('should serve the recorded status, headers and body', () => {
    // arrange
    const response = new ReplayResponse(
      createResponse({
        status: 404,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: { size: 2, mimeType: 'application/json', text: '{}' }
      })
    );

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result).toEqual({
      statusCode: 404,
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
  });

  it('should drop the headers of the recorded encoding and connection', () => {
    // arrange
    const response = new ReplayResponse(
      createResponse({
        headers: [
          { name: 'Content-Encoding', value: 'br' },
          { name: 'Content-Length', value: '10' },
          { name: 'Transfer-Encoding', value: 'chunked' },
          { name: 'Connection', value: 'keep-alive' },
          { name: 'Keep-Alive', value: 'timeout=5' },
          { name: 'ETag', value: 'W/"1"' }
        ]
      })
    );

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result.headers).toEqual({ etag: 'W/"1"' });
  });

  it('should combine the repeated headers', () => {
    // arrange
    const response = new ReplayResponse(
      createResponse({
        headers: [
          { name: 'Vary', value: 'Accept' },
          { name: 'vary', value: 'Accept-Encoding' }
        ]
      })
    );

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result.headers).toEqual({ vary: 'Accept, Accept-Encoding' });
  });

  it('should serve only the first of the recorded cookies', () => {
    // arrange
    const response = new ReplayResponse(
      createResponse({
        headers: [
          { name: 'Set-Cookie', value: 'a=1; Path=/' },
          { name: 'Set-Cookie', value: 'b=2; Path=/' }
        ]
      })
    );

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result.headers).toEqual({ 'set-cookie': 'a=1; Path=/' });
  });

  it('should decode a body recorded in base64', () => {
    // arrange
    const response = new ReplayResponse(
      createResponse({
        content: {
          size: 4,
          mimeType: 'application/octet-stream',
          text: Buffer.from([0, 255, 16, 128]).toString('base64'),
          encoding: 'base64'
        }
      })
    );

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(result.body as ArrayBuffer))).toEqual([
      0, 255, 16, 128
    ]);
  });

  it('should serve an empty body when the HAR has no content', () => {
    // arrange
    const response = new ReplayResponse(createResponse());

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result.body).toBe('');
  });

  it('should fail with a network error when no response was recorded', () => {
    // arrange
    const response = new ReplayResponse(createResponse({ status: 0 }));

    // act
    const result = response.toStaticResponse();

    // assert
    expect(result).toEqual({ forceNetworkError: true });
  });
});
