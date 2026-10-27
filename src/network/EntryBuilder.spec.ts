import { EntryBuilder } from './EntryBuilder.ts';
import { NetworkRequest } from './NetworkRequest.ts';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('EntryBuilder', () => {
  let request!: NetworkRequest;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1);
    request = new NetworkRequest(
      '1',
      'https://example.com/path',
      'https://example.com/path',
      '1'
    );

    request.requestMethod = 'POST';
    request.protocol = 'h2';
    request.setIssueTime(Date.now(), 1);
  });

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
    jest.useRealTimers();
  });

  describe('build', () => {
    it('should build an entry with the default properties', async () => {
      // arrange
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        startedDateTime: '1970-01-01T00:00:01.000Z',
        cache: {},
        serverIPAddress: '',
        request: {
          bodySize: 0,
          cookies: [],
          headers: [],
          headersSize: -1,
          httpVersion: 'http/2.0',
          method: 'POST',
          queryString: [],
          url: 'https://example.com/path'
        },
        response: {
          bodySize: -1,
          content: {
            mimeType: 'x-unknown',
            size: 0
          },
          cookies: [],
          headers: [],
          headersSize: -1,
          httpVersion: 'http/2.0',
          redirectURL: '',
          status: 0,
          statusText: ''
        },
        time: 0,
        timings: {
          blocked: -2,
          connect: -1,
          dns: -1,
          receive: 0,
          send: 0,
          ssl: -1,
          wait: 0
        }
      });
    });

    it('should build an entry with the response body', async () => {
      // arrange
      const mimeType = 'application/json';
      const text = '{"foo": "bar"}';
      const size = text.length;
      request.setContentData(
        Promise.resolve({ body: text, base64Encoded: false })
      );
      request.resourceSize = size;
      request.mimeType = mimeType;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        response: {
          content: {
            mimeType,
            size,
            text
          }
        }
      });
    });

    it.each([{ input: 304 }, { input: 206 }])(
      'should build an entry leaving compression out when statusCode is $status',
      async ({ input }) => {
        // arrange
        const mimeType = 'application/json';
        const text = '{"foo": "bar"}';
        const size = text.length;
        request.setContentData(
          Promise.resolve({ body: text, base64Encoded: false })
        );
        request.responseHeadersText = 'HTTP/1.1 404 Not Found';
        request.resourceSize = size;
        request.mimeType = mimeType;
        request.statusCode = input;
        const entryBuilder = new EntryBuilder(request);
        // act
        const entry = await entryBuilder.build();
        // assert
        expect(entry).toMatchObject({
          response: {
            content: {
              compression: undefined
            }
          }
        });
      }
    );

    it('should build an entry leaving compression out when response headers text is not defined', async () => {
      // arrange
      const mimeType = 'application/json';
      const text = '{"foo": "bar"}';
      const size = text.length;
      request.setContentData(
        Promise.resolve({ body: text, base64Encoded: false })
      );
      request.resourceSize = size;
      request.mimeType = mimeType;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        response: {
          content: {
            compression: undefined
          }
        }
      });
    });

    it('should build an entry with compression', async () => {
      // arrange
      const mimeType = 'application/json';
      const text = '{"foo": "bar"}';
      const size = text.length;
      request.setContentData(
        Promise.resolve({ body: text, base64Encoded: false })
      );
      request.responseHeadersText = 'HTTP/1.1 404 Not Found';
      request.resourceSize = size;
      request.mimeType = mimeType;
      request.transferSize = request.responseHeadersText.length + 4;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        response: {
          bodySize: 4,
          content: {
            compression: 10
          }
        }
      });
    });

    it('should build an entry with an unknown body size and no compression when the transfer size does not cover the headers', async () => {
      // arrange
      request.statusCode = 101;
      request.responseHeadersText =
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n\r\n';
      request.transferSize = 0;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry.response.bodySize).toBe(-1);
      expect(entry.response.content.compression).toBeUndefined();
    });

    it('should build an entry with request cookies', async () => {
      // arrange
      request.requestHeaders = [
        {
          name: 'cookie',
          value: 'foo=bar;'
        }
      ];
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        request: {
          cookies: [
            {
              name: 'foo',
              value: 'bar'
            }
          ]
        }
      });
    });

    it('should build an entry with response cookies', async () => {
      // arrange
      request.responseHeaders = [
        {
          name: 'set-cookie',
          value:
            'foo=bar; Expires=Wed, 21 Oct 2021 07:28:00 GMT; Secure; HttpOnly'
        }
      ];
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        response: {
          cookies: [
            {
              name: 'foo',
              value: 'bar',
              expires: '2021-10-21T07:28:00.000Z',
              secure: true,
              httpOnly: true
            }
          ]
        }
      });
    });

    it('should build an entry leaving send out when start is before end', async () => {
      // arrange
      request.timing = {
        connectEnd: 0.47,
        connectStart: -1,
        dnsEnd: 1,
        dnsStart: -1,
        proxyEnd: -1,
        proxyStart: -1,
        pushEnd: 0,
        pushStart: 0,
        receiveHeadersStart: 0,
        receiveHeadersEnd: 0,
        requestTime: 208215.857187,
        sendEnd: 0.24,
        sendStart: 0.47,
        sslEnd: -1,
        sslStart: -1,
        workerFetchStart: -1,
        workerReady: -1,
        workerRespondWithSettled: -1,
        workerStart: -1
      };
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        timings: {
          send: 0
        }
      });
    });

    it('should build an entry with expected timings', async () => {
      // arrange
      request.setIssueTime(208215.856474, 1673020881.302266);
      request.endTime = 208216.156207;
      request.timing = {
        connectEnd: -1,
        connectStart: -1,
        dnsEnd: -1,
        dnsStart: -1,
        proxyEnd: -1,
        proxyStart: -1,
        pushEnd: 0,
        pushStart: 0,
        receiveHeadersStart: 0,
        receiveHeadersEnd: 298.482,
        requestTime: 208215.857187,
        sendEnd: 0.47,
        sendStart: 0.24,
        sslEnd: -1,
        sslStart: -1,
        workerFetchStart: -1,
        workerReady: -1,
        workerRespondWithSettled: -1,
        workerStart: -1
      };
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        time: 299.73299999255687,
        timings: {
          blocked: 0.9529999867174774,
          dns: -1,
          ssl: -1,
          connect: -1,
          send: 0.22999999999999998,
          wait: 298.012000012882,
          receive: 0.5379999929573387
        }
      });
    });

    it('should build an entry parsing IP address', async () => {
      // arrange
      request.setRemoteAddress('1.1.1.1', 80);
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        serverIPAddress: '1.1.1.1'
      });
    });

    it.each([
      { input: '[2001:db8::1]', expected: '2001:db8::1' },
      { input: '2001:db8::1', expected: '2001:db8::1' },
      { input: '1.1.1.1', expected: '1.1.1.1' }
    ])(
      'should build an entry parsing $input address',
      async ({ input, expected }) => {
        // arrange
        request.setRemoteAddress(input, 8080);
        const entryBuilder = new EntryBuilder(request);
        // act
        const entry = await entryBuilder.build();
        // assert
        expect(entry).toMatchObject({
          serverIPAddress: expected
        });
      }
    );

    it('should build an entry removing fragments from URL', async () => {
      // arrange
      request.url = 'http://example.com/#id';
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        request: {
          url: 'http://example.com/'
        }
      });
    });

    it('should remove fragments from URL preserving a query params', async () => {
      // arrange
      request.url = 'http://example.com/data.csv?label:new#row=5-7';
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        request: {
          url: 'http://example.com/data.csv?label:new'
        }
      });
    });

    it('should build an entry setting connection ID', async () => {
      // arrange
      const connection = '1';
      request.connectionId = connection;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        connection
      });
    });

    it('should build an entry omitting connection ID if it equals 0', async () => {
      // arrange
      request.connectionId = '0';
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).not.toHaveProperty('connection');
    });

    it('should build an entry with the failure reason of a failed request', async () => {
      // arrange
      request.failDescription = 'net::ERR_NAME_NOT_RESOLVED';
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        response: { _error: 'net::ERR_NAME_NOT_RESOLVED' }
      });
    });

    it('should build an entry omitting the failure reason if the request did not fail', async () => {
      // arrange
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry.response).not.toHaveProperty('_error');
    });

    it('should build an entry with the request body', async () => {
      // arrange
      const mimeType = 'application/json';
      const text = '{"foo": "bar"}';
      const bodySize = text.length;
      const headers = [
        { name: 'content-type', value: mimeType },
        { name: 'content-length', value: `${bodySize}` }
      ];
      request.setRequestFormData(text);
      request.requestHeaders = headers;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        request: {
          headers,
          bodySize,
          postData: {
            mimeType,
            text
          }
        }
      });
    });

    it('should build an entry with the websocket frames', async () => {
      // arrange
      const time = 208215.857187;
      const data = 'test';
      const opcode = 1;
      const mask = false;
      request.setIssueTime(208215.856474, 1673020881.302266);
      request.statusCode = 101;
      request.url = 'ws://example.com';
      request.addProtocolFrame(
        { mask, opcode, payloadData: data },
        time,
        false
      );
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        _webSocketMessages: [
          {
            data,
            opcode,
            mask,
            time: expect.closeTo(1673020881.302979, 6),
            type: 'response'
          }
        ]
      });
    });

    it('should build an entry with the event source messages', async () => {
      // arrange
      const time = 208215.857187;
      const data = 'test';
      const eventName = 'data';
      const eventId = '1';
      request.setIssueTime(208215.856474, 1673020881.302266);
      request.mimeType = 'text/event-stream';
      request.addEventSourceMessage(time, eventName, eventId, data);
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        _eventSourceMessages: [
          {
            eventName,
            eventId,
            data,
            time: expect.closeTo(1673020881.302979, 6)
          }
        ]
      });
    });

    it('should build an entry where the request body is multipart/form-data', async () => {
      // arrange
      const mimeType = 'multipart/form-data; boundary=12345';
      const text = `--12345\r
Content-Disposition: form-data; name="foo"\r
\r
bar\r
--12345--`;
      const bodySize = text.length;
      const headers = [
        {
          name: 'content-type',
          value: mimeType
        },
        { name: 'content-length', value: `${bodySize}` }
      ];
      request.setRequestFormData(text);
      request.requestHeaders = headers;
      const entryBuilder = new EntryBuilder(request);
      // act
      const entry = await entryBuilder.build();
      // assert
      expect(entry).toMatchObject({
        request: {
          headers,
          bodySize,
          postData: {
            mimeType,
            text,
            params: [
              {
                name: 'foo',
                value: 'bar'
              }
            ]
          }
        }
      });
    });
  });
});
