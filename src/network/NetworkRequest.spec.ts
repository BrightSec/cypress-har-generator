import { NetworkRequest } from './NetworkRequest.ts';
import { describe, expect, it } from '@jest/globals';
import type { Protocol } from 'devtools-protocol';

describe('NetworkRequest', () => {
  const timing: Protocol.Network.ResourceTiming = {
    requestTime: 3,
    proxyStart: 4,
    proxyEnd: 5,
    dnsStart: 6,
    dnsEnd: 7,
    connectStart: 8,
    connectEnd: 9,
    sslStart: 10,
    sslEnd: 11,
    workerStart: 12,
    workerReady: 13,
    sendStart: 14,
    sendEnd: 15,
    pushStart: 16,
    pushEnd: 17,
    receiveHeadersStart: 18,
    receiveHeadersEnd: 19,
    workerFetchStart: 20,
    workerRespondWithSettled: 21
  };

  let sut!: NetworkRequest;

  beforeEach(() => {
    sut = new NetworkRequest(
      '1',
      'https://example.com?foo=bar',
      'https://example.com',
      '1'
    );
  });

  describe('addEventSourceMessage', () => {
    it('should store the message time as wall-clock time', () => {
      // arrange
      sut.setIssueTime(208215.856474, 1673020881.302266);
      // act
      sut.addEventSourceMessage(208215.857187, 'data', '1', 'test');
      // assert
      expect(sut.eventSourceMessages).toMatchObject([
        { time: expect.closeTo(1673020881.302979, 6) }
      ]);
    });

    it('should add an event source message', () => {
      // arrange
      const time = 208215.857187;
      const data = 'test';
      const eventName = 'data';
      const eventId = '1';
      sut.mimeType = 'text/event-stream';
      // act
      sut.addEventSourceMessage(time, eventName, eventId, data);
      // assert
      expect(sut).toMatchObject({
        eventSourceMessages: [
          {
            time,
            eventName,
            eventId,
            data
          }
        ]
      });
    });
  });

  describe('addProtocolFrame', () => {
    it('should store the frame time as wall-clock time', () => {
      // arrange
      sut.setIssueTime(208215.856474, 1673020881.302266);
      // act
      sut.addProtocolFrame(
        { mask: false, opcode: 1, payloadData: 'test' },
        208215.857187,
        true
      );
      // assert
      expect(sut.frames).toMatchObject([
        { time: expect.closeTo(1673020881.302979, 6) }
      ]);
    });
  });

  describe('addProtocolFrameError', () => {
    it('should store the frame time as wall-clock time', () => {
      // arrange
      sut.setIssueTime(208215.856474, 1673020881.302266);
      // act
      sut.addProtocolFrameError('error', 208215.857187);
      // assert
      expect(sut.frames).toMatchObject([
        { time: expect.closeTo(1673020881.302979, 6) }
      ]);
    });
  });

  describe('addExtraRequestInfo', () => {
    it('should set request headers', () => {
      // arrange
      const requestHeaders = [{ name: 'foo', value: 'bar' }];
      // act
      sut.addExtraRequestInfo({ requestHeaders });
      // assert
      expect(sut).toMatchObject({
        requestHeaders
      });
    });

    it('should the flag that indicates there is extra info', () => {
      // arrange
      const requestHeaders = [{ name: 'foo', value: 'bar' }];
      // act
      sut.addExtraRequestInfo({ requestHeaders });
      // assert
      expect(sut).toMatchObject({
        hasExtraRequestInfo: true
      });
    });

    it('should reset request headers text', () => {
      // arrange
      const requestHeaders = [{ name: 'foo', value: 'bar' }];
      // act
      sut.addExtraRequestInfo({ requestHeaders });
      // assert
      expect(sut).toMatchObject({
        requestHeadersText: ''
      });
    });
  });

  describe('isBlob', () => {
    it('should return true if the schema starts from the blob', () => {
      // arrange
      sut.url = 'blob:http://localhost:8000/image.jpg';
      // act
      const result = sut.isBlob();
      // assert
      expect(result).toBe(true);
    });

    it('should return false if the schema is not the blob', () => {
      // act
      const result = sut.isBlob();
      // assert
      expect(result).toBe(false);
    });
  });

  describe('addExtraResponseInfo', () => {
    it('should set response headers', () => {
      // arrange
      const responseHeaders = [{ name: 'foo', value: 'bar' }];
      // act
      sut.addExtraResponseInfo({ responseHeaders });
      // assert
      expect(sut).toMatchObject({
        responseHeaders
      });
    });

    it('should the flag that indicates there is extra info', () => {
      // arrange
      const responseHeaders = [{ name: 'foo', value: 'bar' }];
      // act
      sut.addExtraResponseInfo({ responseHeaders });
      // assert
      expect(sut).toMatchObject({
        hasExtraResponseInfo: true
      });
    });

    it('should set response headers text', () => {
      // arrange
      const responseHeaders = [{ name: 'foo', value: 'bar' }];
      const responseHeadersText = 'HTTP/1.1 404 Not Found\r\nfoo: bar';
      // act
      sut.addExtraResponseInfo({
        responseHeaders,
        responseHeadersText
      });
      // assert
      expect(sut).toMatchObject({
        responseHeadersText
      });
    });

    it('should build request headers text from the extra info headers', () => {
      // arrange
      const requestHeaders = [{ name: 'foo', value: 'bar' }];
      sut.requestMethod = 'GET';
      sut.addExtraRequestInfo({ requestHeaders });
      const responseHeaders = requestHeaders;
      const responseHeadersText = 'HTTP/1.1 404 Not Found\r\nfoo: bar';
      // act
      sut.addExtraResponseInfo({
        responseHeaders,
        responseHeadersText
      });
      // assert
      expect(sut).toMatchObject({
        requestHeadersText: 'GET /?foo=bar HTTP/1.1\r\nfoo: bar\r\n',
        requestHttpVersion: 'HTTP/1.1'
      });
    });

    it('should keep the request headers text sent by the browser', () => {
      // arrange
      const requestHeadersText = 'GET /?foo=bar HTTP/1.1\r\nfoo: baz\r\n';
      sut.requestMethod = 'GET';
      sut.requestHeaders = [{ name: 'foo', value: 'baz' }];
      sut.requestHeadersText = requestHeadersText;
      // act
      sut.addExtraResponseInfo({
        responseHeaders: [],
        responseHeadersText: 'HTTP/1.1 404 Not Found\r\n'
      });
      // assert
      expect(sut).toMatchObject({ requestHeadersText });
    });
  });

  describe('increaseTransferSize', () => {
    it('should increase the transfer size', () => {
      // arrange
      sut.transferSize = 1;
      // act
      sut.increaseTransferSize(2);
      // assert
      expect(sut).toMatchObject({
        transferSize: 3
      });
    });

    it('should set the initial transfer size if omitted', () => {
      // act
      sut.increaseTransferSize(1);
      // assert
      expect(sut).toMatchObject({
        transferSize: 1
      });
    });
  });

  describe('priority', () => {
    it('should return current priority', () => {
      // arrange
      const priority = 'High';
      sut.priority = priority;
      // act
      const result = sut.priority;
      // assert
      expect(result).toBe(priority);
    });

    it('should return initial priority', () => {
      // arrange
      const priority = 'High';
      sut.initialPriority = priority;
      // act
      const result = sut.priority;
      // assert
      expect(result).toBe(priority);
    });

    it('should return undefined', () => {
      // act
      const result = sut.priority;
      // assert
      expect(result).toBeUndefined();
    });
  });

  describe('setContentData', () => {
    it.each([
      {
        input: { body: 'test', base64Encoded: false },
        expected: { text: 'test' }
      },
      {
        input: { body: 'dGVzdA==', base64Encoded: true },
        expected: { text: 'dGVzdA==', encoding: 'base64' }
      }
    ])(
      'should parse the content when base64Encoded is $input.base64Encoded',
      async ({ input, expected }) => {
        // act
        sut.setContentData(Promise.resolve(input));
        // assert
        const result = await sut.contentData();
        expect(result).toMatchObject(expected);
      }
    );

    it('should return an error when resource type is WS', async () => {
      // arrange
      sut.resourceType = 'WebSocket';
      // act
      sut.setContentData(
        Promise.resolve({ body: 'test', base64Encoded: false })
      );
      // assert
      const result = await sut.contentData();
      expect(result).toMatchObject({
        error: 'Content for WebSockets is currently not supported'
      });
    });

    it('should return an error when content is broken', async () => {
      // act
      sut.setContentData(Promise.reject(new Error('something went wrong')));
      // assert
      const result = await sut.contentData();
      expect(result).toMatchObject({
        error: 'something went wrong'
      });
    });
  });

  describe('formParameters', () => {
    it('should return undefined when content-type is missed', async () => {
      // arrange
      const requestFormData = `--12345\r
Content-Disposition: form-data; name="foo"\r
\r
bar\r
--12345--`;
      sut.setRequestFormData(requestFormData);
      // act
      const result = await sut.formParameters();
      // assert
      expect(result).toEqual([]);
    });

    it('should return undefined when boundary is missed', async () => {
      // arrange
      sut.requestHeaders = [
        {
          name: 'content-type',
          value: 'multipart/form-data'
        }
      ];
      const requestFormData = `--12345\r
Content-Disposition: form-data; name="foo"\r
\r
bar\r
--12345--`;
      // act
      sut.setRequestFormData(requestFormData);
      // assert
      const result = await sut.formParameters();
      expect(result).toEqual([]);
    });

    it('should return undefined when form-data is missed', async () => {
      // arrange
      sut.requestHeaders = [
        {
          name: 'content-type',
          value: 'multipart/form-data; boundary=12345'
        }
      ];
      // act
      const result = await sut.formParameters();
      // assert
      expect(result).toEqual([]);
    });

    it('should return undefined when form urlencoded data is missed', async () => {
      // arrange
      sut.requestHeaders = [
        {
          name: 'content-type',
          value: 'application/x-www-form-urlencoded'
        }
      ];
      // act
      const result = await sut.formParameters();
      // assert
      expect(result).toEqual([]);
    });
  });

  describe('setRequestFormData', () => {
    it('should set form data', async () => {
      // arrange
      const requestFormData = 'foo=bar';
      // act
      sut.setRequestFormData(requestFormData);
      // assert
      const result = await sut.requestFormData();
      expect(result).toBe(requestFormData);
    });

    it('should parse the form urlencoded data', async () => {
      // arrange
      const requestFormData = 'foo=bar';
      sut.requestHeaders = [
        {
          name: 'content-type',
          value: 'application/x-www-form-urlencoded'
        }
      ];
      // act
      sut.setRequestFormData(requestFormData);
      // assert
      const result = await sut.formParameters();
      expect(result).toMatchObject([
        {
          name: 'foo',
          value: 'bar'
        }
      ]);
    });

    it('should parse the form data', async () => {
      // arrange
      const requestFormData = `--12345\r
Content-Disposition: form-data; name="foo"\r
\r
bar\r
--12345\r
Content-Disposition: form-data; name="file"; filename="a.txt"\r
Content-Type: text/plain\r
\r
content of txt...\r
--12345--`;
      sut.requestHeaders = [
        {
          name: 'content-type',
          value: 'multipart/form-data; boundary=12345'
        }
      ];
      // act
      sut.setRequestFormData(requestFormData);
      // assert
      const result = await sut.formParameters();
      expect(result).toMatchObject([
        {
          name: 'foo',
          value: 'bar'
        },
        {
          name: 'file',
          value: 'content of txt...',
          fileName: 'a.txt',
          contentType: 'text/plain'
        }
      ]);
    });
  });

  describe('requestHttpVersion', () => {
    it('should return the HTTP version', () => {
      // arrange
      sut.requestHeadersText = 'POST / HTTP/1.1';
      // act
      const result = sut.requestHttpVersion;
      // assert
      expect(result).toBe('HTTP/1.1');
    });

    it('should return the default HTTP version', () => {
      // arrange
      sut.requestHeadersText = 'POST / HTTP';
      // act
      const result = sut.requestHttpVersion;
      // assert
      expect(result).toBe('HTTP/0.9');
    });

    it('should retrieve the version from version header field', () => {
      // arrange
      sut.requestHeaders = [
        {
          name: 'version',
          value: 'HTTP/2'
        }
      ];
      // act
      const result = sut.requestHttpVersion;
      // assert
      expect(result).toBe('HTTP/2');
    });

    it('should retrieve the version from :version header field', () => {
      // arrange
      sut.requestHeaders = [
        {
          name: ':version',
          value: 'HTTP/2'
        }
      ];
      // act
      const result = sut.requestHttpVersion;
      // assert
      expect(result).toBe('HTTP/2');
    });

    it.each([
      { input: 'h2', expected: 'http/2.0' },
      { input: 'http/1.1', expected: 'http/1.1' }
    ])(
      'should retrieve the version from $input protocol',
      ({ input, expected }) => {
        // arrange
        sut.protocol = input;
        // act
        const result = sut.requestHttpVersion;
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('responseHttpVersion', () => {
    it('should return the HTTP version', () => {
      // arrange
      sut.responseHeadersText = 'HTTP/1.1 404 Not Found';
      // act
      const result = sut.responseHttpVersion();
      // assert
      expect(result).toBe('HTTP/1.1');
    });

    it('should return the default HTTP version', () => {
      // arrange
      sut.responseHeadersText = 'HTTP 404 Not Found';
      // act
      const result = sut.responseHttpVersion();
      // assert
      expect(result).toBe('HTTP/0.9');
    });

    it('should retrieve the version from version header field', () => {
      // arrange
      sut.responseHeaders = [
        {
          name: 'version',
          value: 'HTTP/2'
        }
      ];
      // act
      const result = sut.responseHttpVersion();
      // assert
      expect(result).toBe('HTTP/2');
    });

    it('should retrieve the version from :version header field', () => {
      // arrange
      sut.responseHeaders = [
        {
          name: ':version',
          value: 'HTTP/2'
        }
      ];
      // act
      const result = sut.responseHttpVersion();
      // assert
      expect(result).toBe('HTTP/2');
    });

    it.each([
      { input: 'h2', expected: 'http/2.0' },
      { input: 'http/1.1', expected: 'http/1.1' }
    ])(
      'should retrieve the version from $input protocol',
      ({ input, expected }) => {
        // arrange
        sut.protocol = input;
        // act
        const result = sut.responseHttpVersion();
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('getWallTime', () => {
    it('should calculate wall time', () => {
      // arrange
      const date = new Date(1);
      sut.setIssueTime(0, date.getTime());
      // act
      const result = sut.getWallTime(date.getTime());
      // assert
      expect(result).toBe(2);
    });

    it('should return start time if wall issue time is not exist', () => {
      // arrange
      const date = new Date(1);
      // act
      const result = sut.getWallTime(date.getTime());
      // assert
      expect(result).toBe(1);
    });
  });

  describe('requestHeaders', () => {
    it('should set the request headers', () => {
      // arrange
      const requestHeaders = [
        {
          name: 'foo',
          value: 'bar'
        }
      ];
      // act
      sut.requestHeaders = requestHeaders;
      // assert
      expect(sut).toMatchObject({
        requestHeaders
      });
    });

    it('should parse the cookie from headers', () => {
      // act
      sut.requestHeaders = [
        {
          name: 'cookie',
          value: 'foo=bar;'
        }
      ];
      // assert
      expect(sut).toMatchObject({
        requestCookies: [
          {
            name: 'foo',
            value: 'bar'
          }
        ]
      });
    });

    it('should retrieve the content length from headers', () => {
      // arrange
      const contentLength = 100;
      // act
      sut.requestHeaders = [
        {
          name: 'Content-Length',
          value: contentLength.toString()
        }
      ];
      // assert
      expect(sut).toMatchObject({
        contentLength
      });
    });

    it('should retrieve the content type from headers', () => {
      // arrange
      const requestContentType = 'application/json';
      // act
      sut.requestHeaders = [
        {
          name: 'Content-Type',
          value: requestContentType
        }
      ];
      // assert
      expect(sut).toMatchObject({
        requestContentType
      });
    });
  });

  describe('responseHeaders', () => {
    it('should set the response headers', () => {
      // arrange
      const responseHeaders = [
        {
          name: 'foo',
          value: 'bar'
        }
      ];
      // act
      sut.responseHeaders = responseHeaders;
      // assert
      expect(sut).toMatchObject({
        responseHeaders
      });
    });

    it('should parse the cookie from headers', () => {
      // act
      sut.responseHeaders = [
        {
          name: 'set-cookie',
          value:
            'foo=bar; Expires=Wed, 21 Oct 2021 07:28:00 GMT; Secure; HttpOnly'
        }
      ];
      // assert
      expect(sut).toMatchObject({
        responseCookies: [
          {
            name: 'foo',
            value: 'bar',
            expires: 'Wed, 21 Oct 2021 07:28:00 GMT',
            secure: true,
            httpOnly: true
          }
        ]
      });
    });
  });

  describe('url', () => {
    it('should set the URL', () => {
      // arrange
      const url = 'https://new-example.com';
      // act
      sut.url = url;
      // assert
      expect(sut).toMatchObject({
        url
      });
    });

    it('should reset a query string', () => {
      // arrange
      const url = 'https://new-example.com';
      // act
      sut.url = url;
      // assert
      expect(sut).toMatchObject({
        queryString: expect.not.stringContaining('foo'),
        queryParameters: undefined
      });
    });

    it('should parse a query string when the url contains a fragment', () => {
      // arrange
      const url = 'https://new-example.com#id?foo=bar';
      // act
      sut.url = url;
      // assert
      expect(sut).toMatchObject({
        queryString: 'foo=bar'
      });
    });

    it('should parse a query parameters', () => {
      // arrange
      const url = 'https://new-example.com?bar=baz';
      // act
      sut.url = url;
      // assert
      expect(sut).toMatchObject({
        queryString: 'bar=baz',
        queryParameters: [{ name: 'bar', value: 'baz' }]
      });
    });

    it('should parse a query parameters when only key is present', () => {
      // arrange
      const url = 'https://new-example.com?bar';
      // act
      sut.url = url;
      // assert
      expect(sut).toMatchObject({
        queryString: 'bar',
        queryParameters: [{ name: 'bar', value: '' }]
      });
    });
  });

  describe('setRemoteAddress', () => {
    it('should set the remote address', () => {
      // arrange
      const host = '1.2.3.4';
      const port = 8080;
      // act
      sut.setRemoteAddress(host, port);
      // assert
      expect(sut).toMatchObject({ remoteAddress: `${host}:${port}` });
    });
  });

  describe('timing', () => {
    it('should set the timing', () => {
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({ timing });
    });

    it('should set the start time', () => {
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({ startTime: timing.requestTime });
    });

    it('should set the start time', () => {
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({ startTime: timing.requestTime });
    });

    it('should set the initial response time', () => {
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({
        responseReceivedTime:
          timing.requestTime + timing.receiveHeadersEnd / 1000.0
      });
    });

    it('should update the response time based on timings', () => {
      // arrange
      sut.responseReceivedTime = 4;
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({
        responseReceivedTime:
          timing.requestTime + timing.receiveHeadersEnd / 1000.0
      });
    });

    it('should keep the response time when it is greater then the headers received time', () => {
      // arrange
      sut.responseReceivedTime = 3;
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({
        responseReceivedTime: 3
      });
    });
  });

  describe('setFromMemoryCache', () => {
    it('should drop the timing', () => {
      // arrange
      sut.timing = timing;
      // act
      sut.setFromMemoryCache();
      // assert
      expect(sut).toMatchObject({ fromMemoryCache: true, timing: undefined });
    });

    it('should ignore a timing set afterwards', () => {
      // arrange
      sut.setIssueTime(5, 1);
      sut.setFromMemoryCache();
      // act
      sut.timing = timing;
      // assert
      expect(sut).toMatchObject({ timing: undefined, startTime: 5 });
    });
  });

  describe('cached', () => {
    it.each([
      {
        fromMemoryCache: true,
        fromDiskCache: false,
        transferSize: 0,
        expected: true
      },
      {
        fromMemoryCache: false,
        fromDiskCache: true,
        transferSize: 0,
        expected: true
      },
      {
        fromMemoryCache: false,
        fromDiskCache: true,
        transferSize: 10,
        expected: false
      },
      {
        fromMemoryCache: false,
        fromDiskCache: false,
        transferSize: 0,
        expected: false
      }
    ])(
      'should return $expected when served from the memory cache is $fromMemoryCache, from the disk cache is $fromDiskCache and the transfer size is $transferSize',
      ({ fromMemoryCache, fromDiskCache, transferSize, expected }) => {
        // arrange
        if (fromMemoryCache) {
          sut.setFromMemoryCache();
        }
        sut.fromDiskCache = fromDiskCache;
        sut.transferSize = transferSize;
        // act
        const result = sut.cached();
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('cachedInMemory', () => {
    it('should return false for a response served from the disk cache', () => {
      // arrange
      sut.fromDiskCache = true;
      // act
      const result = sut.cachedInMemory();
      // assert
      expect(result).toBe(false);
    });

    it('should return true for a response served from the memory cache', () => {
      // arrange
      sut.setFromMemoryCache();
      // act
      const result = sut.cachedInMemory();
      // assert
      expect(result).toBe(true);
    });
  });

  describe('endTime', () => {
    it('should return -1 by default', () => {
      // act
      const result = sut.endTime;
      // assert
      expect(result).toBe(-1);
    });

    it('should set the end time', () => {
      // act
      sut.endTime = 5;
      // assert
      expect(sut).toMatchObject({ endTime: 5 });
    });

    it('should set the response receive time when it is greater then the end time', () => {
      // arrange
      sut.responseReceivedTime = 6;
      // act
      sut.endTime = 5;
      // assert
      expect(sut).toMatchObject({ responseReceivedTime: 5 });
    });

    it('should set the end time to greater or equal value then response received time', () => {
      // arrange
      sut.timing = timing;
      // act
      sut.endTime = 3;
      // assert
      expect(sut).toMatchObject({
        endTime: sut.responseReceivedTime
      });
    });
  });
});
