import { Logger } from '../utils/Logger.ts';
import { NetworkObserver } from './NetworkObserver.ts';
import type { NetworkRequest } from './NetworkRequest.ts';
import type { NetworkObserverOptions } from './NetworkObserverOptions.ts';
import type { RequestFilter } from './filters/RequestFilter.ts';
import { CompositeFilter } from './filters/CompositeFilter.ts';
import type { Network } from './Network.ts';
import type { Protocol } from 'devtools-protocol';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  anyFunction,
  anyString,
  anything,
  instance,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';

describe('NetworkObserver', () => {
  const networkMock = mock<Network>();
  const loggerMock = mock<Logger>();
  const requestFilterMock = mock<RequestFilter>();
  const callback = jest.fn();
  const timings = {
    requestTime: -1,
    proxyStart: -1,
    proxyEnd: -1,
    dnsStart: -1,
    dnsEnd: -1,
    connectStart: -1,
    connectEnd: -1,
    sslStart: -1,
    sslEnd: -1,
    workerStart: -1,
    workerReady: -1,
    workerFetchStart: -1,
    workerRespondWithSettled: -1,
    sendStart: -1,
    sendEnd: -1,
    pushStart: 0,
    pushEnd: 0,
    receiveHeadersEnd: -1
  };
  const response = {
    url: 'http://localhost:8080/',
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Length': '1777',
      'Content-Type': 'text/html; charset=UTF-8'
    },
    mimeType: 'text/html',
    connectionReused: false,
    connectionId: 0,
    remoteIPAddress: '',
    remotePort: 0,
    encodedDataLength: -1,
    responseTime: 1,
    protocol: 'http/1.1'
  };
  const requestWillBeSentEvent = {
    method: 'NetworkNetwork.requestWillBeSent',
    params: {
      requestId: '1',
      documentURL: 'http://localhost:8080/',
      request: {
        url: 'http://localhost:8080/',
        method: 'GET',
        headers: {
          'Upgrade-Insecure-Requests': '1'
        },
        initialPriority: 'VeryHigh'
      },
      timestamp: 1,
      wallTime: 1,
      redirectHasExtraInfo: false,
      type: 'Document'
    }
  };
  const responseReceivedEvent = {
    method: 'Network.responseReceived',
    params: {
      timings,
      response,
      requestId: '1',
      timestamp: 1,
      type: 'Document',
      hasExtraInfo: false
    }
  };
  const loadingFinishedEvent = {
    method: 'Network.loadingFinished',
    params: {
      requestId: '1',
      timestamp: 1,
      encodedDataLength: 0
    }
  };
  const requestWillBeSentExtraInfoEvent = {
    method: 'Network.requestWillBeSentExtraInfo',
    params: {
      requestId: '1',
      headers: {
        Cookie: 'foo=bar'
      },
      connectTiming: {
        requestTime: 1
      }
    }
  };
  const responseReceivedExtraInfoEvent = {
    method: 'Network.responseReceivedExtraInfo',
    params: {
      requestId: '1',
      headers: {
        'Transfer-Encoding': 'chunked'
      },
      resourceIPAddressSpace: 'Local',
      statusCode: 200
    }
  };
  const loadingFailedEvent = {
    method: 'Network.loadingFailed',
    params: {
      requestId: '1',
      timestamp: 1,
      type: 'Document',
      errorText: 'net::ERR_CONNECTION_REFUSED',
      canceled: false
    }
  };
  const dataReceivedEvent = {
    method: 'Network.dataReceived',
    params: {
      requestId: '1',
      timestamp: 1,
      dataLength: 1,
      encodedDataLength: 0
    }
  };
  const eventSourceMessageReceivedEvent = {
    method: 'Network.eventSourceMessageReceived',
    params: {
      requestId: '1',
      timestamp: 1,
      eventName: 'data',
      eventId: '1',
      data: 'test'
    }
  };

  const webSocketEvents = [
    {
      method: 'Network.webSocketCreated',
      params: {
        requestId: '2',
        url: 'ws://localhost:8080/ws'
      }
    },
    {
      method: 'Network.webSocketWillSendHandshakeRequest',
      params: {
        requestId: '2',
        timestamp: 1,
        wallTime: 1,
        request: {
          headers: {
            Upgrade: 'websocket'
          }
        }
      }
    },
    {
      method: 'Network.webSocketHandshakeResponseReceived',
      params: {
        requestId: '2',
        timestamp: 2,
        response: {
          status: 101,
          statusText: 'Switching Protocols',
          headers: {
            Upgrade: 'websocket'
          }
        }
      }
    },
    {
      method: 'Network.webSocketFrameReceived',
      params: {
        requestId: '2',
        timestamp: 3,
        response: {
          opcode: 1,
          mask: false,
          payloadData: 'test'
        }
      }
    }
  ];

  let sut!: NetworkObserver;
  let options!: NetworkObserverOptions;
  let optionsSpy!: NetworkObserverOptions;

  beforeEach(() => {
    options = {};
    optionsSpy = spy(options);
    sut = new NetworkObserver(
      options,
      instance(networkMock),
      instance(loggerMock),
      instance(requestFilterMock)
    );
  });

  afterEach(() => {
    callback.mockReset();
    reset<Logger | Network | RequestFilter | NetworkObserverOptions>(
      optionsSpy,
      loggerMock,
      networkMock,
      requestFilterMock
    );
  });

  describe('subscribe', () => {
    it('should return true when no pending requests', async () => {
      // act
      const result = sut.empty;
      // assert
      expect(result).toBe(true);
    });

    it('should return false when there is at least one pending request', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(cb =>
        cb(requestWillBeSentEvent)
      );
      await sut.subscribe(callback);
      // act
      const result = sut.empty;
      // assert
      expect(result).toBe(false);
    });

    it('should return true when only a WebSocket is open', async () => {
      // arrange
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        for (const event of webSocketEvents) {
          await cb(event);
        }
      });
      await sut.subscribe(callback);
      // act
      const result = sut.empty;
      // assert
      expect(result).toBe(true);
    });

    it('should attach to network events', async () => {
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.attachToTargets(anyFunction())).once();
    });

    it('should handle a simple sequence of browser events', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1'
        })
      );
    });

    it('should add an event source message to the request', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...responseReceivedEvent,
          params: {
            ...responseReceivedEvent.params,
            type: 'EventSource',
            response: {
              ...responseReceivedEvent.params.response,
              mimeType: 'text/event-stream'
            }
          }
        });
        await cb(eventSourceMessageReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1',
          eventSourceMessages: [
            {
              time: 1,
              eventName: 'data',
              eventId: '1',
              data: 'test'
            }
          ]
        })
      );
    });

    it('should drop the timing of the original request from a response served from the memory cache', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            timestamp: 1475233.113563
          }
        });
        await cb({
          method: 'Network.requestServedFromCache',
          params: { requestId: '1' }
        });
        await cb({
          ...responseReceivedEvent,
          params: {
            ...responseReceivedEvent.params,
            timestamp: 1475233.113579,
            response: {
              ...response,
              encodedDataLength: 60920,
              timing: {
                ...timings,
                requestTime: 1475231.954948,
                sendStart: 0.816,
                sendEnd: 0.863,
                receiveHeadersEnd: 3.029
              }
            }
          }
        });
        await cb({
          ...loadingFinishedEvent,
          params: { ...loadingFinishedEvent.params, timestamp: 1475233.113582 }
        });
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1',
          fromMemoryCache: true,
          timing: undefined,
          startTime: 1475233.113563,
          responseReceivedTime: 1475233.113579,
          transferSize: 0
        })
      );
    });

    it('should record how a service worker served a response', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...responseReceivedEvent,
          params: {
            ...responseReceivedEvent.params,
            response: {
              ...response,
              encodedDataLength: 0,
              fromDiskCache: true,
              fromServiceWorker: true,
              cacheStorageCacheName: 'v1',
              serviceWorkerResponseSource: 'cache-storage'
            }
          }
        });
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1',
          fromDiskCache: true,
          fetchedViaServiceWorker: true,
          responseCacheStorageCacheName: 'v1',
          serviceWorkerResponseSource: 'cache-storage'
        })
      );
    });

    it('should handle a SXG', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          method: 'Network.signedExchangeReceived',
          params: {
            requestId: '1',
            info: {
              outerResponse: response
            }
          }
        });
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1',
          resourceType: 'SignedExchange',
          statusCode: 200,
          statusText: 'OK'
        })
      );
    });

    it('should update a request headers which has been transferred via SXG', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          method: 'Network.signedExchangeReceived',
          params: {
            requestId: '1',
            info: {
              outerResponse: {
                ...response,
                requestHeaders: { foo: 'bar' }
              }
            }
          }
        });
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1',
          requestHeaders: expect.arrayContaining([
            {
              name: 'foo',
              value: 'bar'
            }
          ])
        })
      );
    });

    it('should keep the outer response of a SXG instead of its redirect response', async () => {
      // arrange
      when(networkMock.getRequestBody(anyString())).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          method: 'Network.signedExchangeReceived',
          params: {
            requestId: '1',
            info: {
              outerResponse: response
            }
          }
        });
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectResponse: {
              ...response,
              status: 303,
              statusText: 'See Other'
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1:redirected.0',
          resourceType: 'SignedExchange',
          statusCode: 200,
          statusText: 'OK'
        })
      );
    });

    it('should count the transfer size of a SXG to its outer request', async () => {
      // arrange
      const transferSizes = new Map<string, number>();
      callback.mockImplementation(request => {
        const { requestId, transferSize } = request as NetworkRequest;
        transferSizes.set(requestId, transferSize);
      });
      when(networkMock.getRequestBody(anyString())).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          method: 'Network.signedExchangeReceived',
          params: {
            requestId: '1',
            info: {
              outerResponse: response
            }
          }
        });
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectResponse: response
          }
        });
        await cb(responseReceivedEvent);
        await new Promise(resolve => setTimeout(resolve, 10));
        await cb({
          ...loadingFinishedEvent,
          params: {
            ...loadingFinishedEvent.params,
            encodedDataLength: 1777
          }
        });
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(Object.fromEntries(transferSizes)).toEqual({
        '1:redirected.0': 1777,
        '1': 0
      });
    });

    it('should change a resource priority', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          method: 'Network.resourceChangedPriority',
          params: {
            requestId: '1',
            newPriority: 'VeryLow'
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'VeryLow'
        })
      );
    });

    it('should increase the resource size while receiving new data chunk', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(dataReceivedEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceSize: 1
        })
      );
    });

    it('should handle a loading failure', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(loadingFailedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1'
        })
      );
      verify(
        loggerMock.debug(
          `Failed request: 1. Reason: ${loadingFailedEvent.params.errorText}`
        )
      ).once();
    });

    it('should keep the failure reason of a failed request', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(loadingFailedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          failDescription: loadingFailedEvent.params.errorText
        })
      );
    });

    it('should load a response body when content is enabled', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.getResponseBody('1')).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).once();
    });

    it('should load a response body when mime is in the list of allowed', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(optionsSpy.includeMimes).thenReturn(['text/html']);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.getResponseBody('1')).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).once();
    });

    it('should load a response body when the response has no mime type', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getResponseBody('1')).thenResolve({
        body: 'ok',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...responseReceivedEvent,
          params: {
            ...responseReceivedEvent.params,
            response: { ...response, mimeType: '' }
          }
        });
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).once();
    });

    it('should skip a response body of a redirect', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getResponseBody(anyString())).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectResponse: {
              ...response,
              status: 302,
              headers: { Location: 'http://localhost:8080/' }
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1:redirected.0')).never();
      verify(networkMock.getResponseBody('1')).once();
    });

    it('should skip a response body when mime is not defined', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.getResponseBody('1')).thenReject(
        new Error('No resource with given identifier found')
      );
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(loadingFailedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).never();
    });

    it('should skip a response body if content is disabled', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.getResponseBody('1')).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).once();
    });

    it('should handle an error while loading a request body', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenReject(
        new Error('something went wrong')
      );
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1'
        })
      );
    });

    it('should load the request body', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: 'test'
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            request: {
              ...requestWillBeSentEvent.params.request,
              method: 'POST',
              hasPostData: true
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getRequestBody('1')).once();
    });

    it.each([
      {
        contentType: 'application/octet-stream',
        bytes: [0x47, 0x49, 0x46, 0xff, 0x00],
        expected: 'GIF\ufffd\u0000'
      },
      {
        contentType: 'text/plain; charset=ISO-8859-1',
        bytes: [0x63, 0x61, 0x66, 0xe9],
        expected: 'café'
      },
      {
        contentType: 'text/plain; charset="windows-1252"',
        bytes: [0x80],
        expected: '€'
      },
      {
        contentType: 'text/plain; charset=unknown',
        bytes: [0x61, 0xff],
        expected: 'a\ufffd'
      }
    ])(
      'should decode a base64-encoded request body with the charset of $contentType',
      async ({ contentType, bytes, expected }) => {
        // arrange
        when(networkMock.getRequestBody('1')).thenResolve({
          postData: Buffer.from(bytes).toString('base64'),
          base64Encoded: true
        } as Protocol.Network.GetRequestPostDataResponse);
        when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
          await cb({
            ...requestWillBeSentEvent,
            params: {
              ...requestWillBeSentEvent.params,
              request: {
                ...requestWillBeSentEvent.params.request,
                method: 'POST',
                headers: { 'Content-Type': contentType },
                hasPostData: true
              }
            }
          });
          await cb(responseReceivedEvent);
          await cb(loadingFinishedEvent);
        });
        await sut.subscribe(callback);
        const request = callback.mock.calls[0][0] as NetworkRequest;
        // act
        const result = await request.requestFormData();
        // assert
        expect(result).toBe(expected);
      }
    );

    it('should parse the form parameters of a base64-encoded multipart request body', async () => {
      // arrange
      const body = Buffer.concat([
        Buffer.from(
          '--x\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n' +
            '--x\r\nContent-Disposition: form-data; name="file"; filename="bin.dat"\r\nContent-Type: application/octet-stream\r\n\r\n'
        ),
        Buffer.from([0x00, 0xff]),
        Buffer.from('\r\n--x--\r\n')
      ]);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: body.toString('base64'),
        base64Encoded: true
      } as Protocol.Network.GetRequestPostDataResponse);
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            request: {
              ...requestWillBeSentEvent.params.request,
              method: 'POST',
              headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
              hasPostData: true
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      await sut.subscribe(callback);
      const request = callback.mock.calls[0][0] as NetworkRequest;
      // act
      const result = await request.formParameters();
      // assert
      expect(result).toEqual([
        {
          name: 'field',
          value: 'value',
          fileName: undefined,
          contentType: undefined
        },
        {
          name: 'file',
          value: '\u0000\ufffd',
          fileName: 'bin.dat',
          contentType: 'application/octet-stream'
        }
      ]);
    });

    it('should utilize the preloaded request body', async () => {
      // arrange
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            request: {
              ...requestWillBeSentEvent.params.request,
              method: 'POST',
              postData: 'test',
              hasPostData: true
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getRequestBody('1')).never();
    });

    it('should prevent loading the request body when the request method forbids the body', async () => {
      // arrange
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            request: {
              ...requestWillBeSentEvent.params.request,
              method: 'OPTIONS',
              hasPostData: false
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getRequestBody('1')).never();
    });

    it('should filter a request out when it does not match a filter criteria', async () => {
      // arrange
      when(requestFilterMock.wouldApply(anything())).thenReturn(true);
      when(requestFilterMock.apply(anything(), anything())).thenReturn(false);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not load a response body of a filtered out request', async () => {
      // arrange
      when(optionsSpy.content).thenReturn(true);
      when(requestFilterMock.wouldApply(anything())).thenReturn(true);
      when(requestFilterMock.apply(anything(), anything())).thenReturn(false);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.getResponseBody('1')).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).never();
    });

    it('should not load a response body of a request to an excluded host', async () => {
      // arrange
      sut = new NetworkObserver(
        { content: true, excludeHosts: ['localhost'] },
        instance(networkMock),
        instance(loggerMock),
        new CompositeFilter()
      );
      when(networkMock.getResponseBody('1')).thenResolve({
        body: '<html></html>',
        base64Encoded: false
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      verify(networkMock.getResponseBody('1')).never();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not keep a filtered out request pending', async () => {
      // arrange
      when(requestFilterMock.wouldApply(anything())).thenReturn(true);
      when(requestFilterMock.apply(anything(), anything())).thenReturn(false);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      await sut.subscribe(callback);
      // act
      const result = sut.empty;
      // assert
      expect(result).toBe(true);
    });

    it('should not filter a request out when the filter criteria are not applicable', async () => {
      // arrange
      when(requestFilterMock.wouldApply(anything())).thenReturn(false);
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '1'
        })
      );
    });

    it('should handle a request extra info coming before browser events', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentExtraInfoEvent);
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectHasExtraInfo: true
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestCookies: expect.arrayContaining([
            expect.objectContaining({
              name: 'foo',
              value: 'bar'
            })
          ]),
          requestId: '1'
        })
      );
    });

    it('should take the request cookies with their attributes from the request extra info', async () => {
      // arrange
      const cookie = {
        domain: 'localhost',
        path: '/',
        expires: 1767225600,
        size: 2,
        httpOnly: true,
        secure: true,
        session: false,
        sameSite: 'Lax',
        priority: 'Medium',
        sourceScheme: 'Secure',
        sourcePort: 8080
      };
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...requestWillBeSentExtraInfoEvent,
          params: {
            ...requestWillBeSentExtraInfoEvent.params,
            headers: { Cookie: 'a=1; b=2' },
            associatedCookies: [
              {
                cookie: { ...cookie, name: 'a', value: '1' },
                blockedReasons: []
              },
              {
                cookie: { ...cookie, name: 'b', value: '2' },
                blockedReasons: ['SameSiteStrict']
              }
            ]
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      const [request]: NetworkRequest[] = callback.mock.calls[0] as any;
      expect(
        request.requestCookies?.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          httpOnly: c.httpOnly,
          secure: c.secure,
          expires: c.expiresDate(new Date())?.toJSON()
        }))
      ).toEqual([
        {
          name: 'a',
          value: '1',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: true,
          expires: '2026-01-01T00:00:00.000Z'
        }
      ]);
    });

    it('should handle a response extra info coming before browser events', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedExtraInfoEvent);
        await cb({
          ...responseReceivedEvent,
          params: {
            ...responseReceivedEvent,
            hasExtraInfo: true
          }
        });
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          responseHeaders: expect.arrayContaining([
            {
              name: 'Transfer-Encoding',
              value: 'chunked'
            }
          ]),
          requestId: '1'
        })
      );
    });

    it.each([
      { order: 'after', extraInfoFirst: false },
      { order: 'before', extraInfoFirst: true }
    ])(
      'should take the status from the response extra info coming $order the response',
      async ({ extraInfoFirst }) => {
        // arrange
        const notModifiedExtraInfoEvent = {
          ...responseReceivedExtraInfoEvent,
          params: {
            ...responseReceivedExtraInfoEvent.params,
            statusCode: 304,
            headersText: 'HTTP/1.1 304 Not Modified\r\n\r\n'
          }
        };
        const revalidatedResponseEvent = {
          ...responseReceivedEvent,
          params: { ...responseReceivedEvent.params, hasExtraInfo: true }
        };
        when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
          await cb(requestWillBeSentEvent);
          await cb(
            extraInfoFirst
              ? notModifiedExtraInfoEvent
              : revalidatedResponseEvent
          );
          await cb(
            extraInfoFirst
              ? revalidatedResponseEvent
              : notModifiedExtraInfoEvent
          );
          await cb(loadingFinishedEvent);
        });
        // act
        await sut.subscribe(callback);
        // assert
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 304,
            statusText: 'Not Modified',
            requestId: '1'
          })
        );
      }
    );

    it('should handle a redirected response', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectResponse: {
              timings,
              url: 'http://localhost:8081/',
              status: 302,
              statusText: 'Found',
              headers: {
                Location: 'http://localhost:8080'
              },
              mimeType: '',
              connectionReused: false,
              connectionId: 1,
              remoteIPAddress: '[::1]',
              remotePort: 8081,
              encodedDataLength: 167,
              responseTime: 1,
              protocol: 'http/1.1'
            }
          }
        });
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          responseHeaders: [
            {
              name: 'Location',
              value: 'http://localhost:8080'
            }
          ],
          statusCode: 302,
          statusText: 'Found',
          requestId: '1:redirected.0'
        })
      );
    });

    it('should not apply the extra info of an unseen redirect to the redirected request', async () => {
      // arrange
      when(networkMock.getRequestBody('1')).thenResolve({
        postData: ''
      });
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentExtraInfoEvent);
        await cb({
          ...responseReceivedExtraInfoEvent,
          params: {
            ...responseReceivedExtraInfoEvent.params,
            headers: { Location: 'http://localhost:8080' },
            statusCode: 302
          }
        });
        await cb({
          ...requestWillBeSentEvent,
          params: {
            ...requestWillBeSentEvent.params,
            redirectHasExtraInfo: true,
            redirectResponse: {
              ...response,
              status: 302,
              statusText: 'Found',
              headers: { Location: 'http://localhost:8080' }
            }
          }
        });
        await cb(requestWillBeSentExtraInfoEvent);
        await cb(responseReceivedExtraInfoEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      // act
      await sut.subscribe(callback);
      // assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          responseHeaders: [
            {
              name: 'Transfer-Encoding',
              value: 'chunked'
            }
          ],
          statusCode: 200,
          requestId: '1'
        })
      );
    });
  });

  describe('unsubscribe', () => {
    it('should disable the network and security domains', async () => {
      // act
      await sut.unsubscribe();
      // assert
      verify(networkMock.detachFromTargets()).once();
    });

    it('should write a WebSocket that is still open with its frames', async () => {
      // arrange
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        for (const event of webSocketEvents) {
          await cb(event);
        }
      });
      await sut.subscribe(callback);
      // act
      await sut.unsubscribe();
      // assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: '2',
          url: 'ws://localhost:8080/ws',
          statusCode: 101,
          frames: [expect.objectContaining({ type: 'response', data: 'test' })]
        })
      );
    });

    it('should not write a closed WebSocket again', async () => {
      // arrange
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        for (const event of webSocketEvents) {
          await cb(event);
        }
        await cb({
          method: 'Network.webSocketClosed',
          params: { requestId: '2', timestamp: 4 }
        });
      });
      await sut.subscribe(callback);
      // act
      await sut.unsubscribe();
      // assert
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should write a finished request whose response body is still loading', async () => {
      // arrange
      const body = { body: '<html></html>', base64Encoded: false };
      let resolveBody!: (value: typeof body) => void;
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getResponseBody('1')).thenReturn(
        new Promise(resolve => (resolveBody = resolve))
      );
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      await sut.subscribe(callback);
      // act
      const unsubscribing = sut.unsubscribe();
      setImmediate(() => resolveBody(body));
      await unsubscribing;
      // assert
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: '1' })
      );
      expect(sut.empty).toBe(true);
    });

    it('should not detach from the targets while a response body is still loading', async () => {
      // arrange
      const body = { body: '<html></html>', base64Encoded: false };
      const order: string[] = [];
      let resolveBody!: (value: typeof body) => void;
      when(optionsSpy.content).thenReturn(true);
      when(networkMock.getResponseBody('1')).thenReturn(
        new Promise(resolve => (resolveBody = resolve))
      );
      when(networkMock.detachFromTargets()).thenCall(async () =>
        order.push('detach')
      );
      when(networkMock.attachToTargets(anyFunction())).thenCall(async cb => {
        await cb(requestWillBeSentEvent);
        await cb(responseReceivedEvent);
        await cb(loadingFinishedEvent);
      });
      await sut.subscribe(callback);
      // act
      const unsubscribing = sut.unsubscribe();
      setImmediate(() => {
        order.push('body');
        resolveBody(body);
      });
      await unsubscribing;
      // assert
      expect(order).toEqual(['body', 'detach']);
    });
  });
});
