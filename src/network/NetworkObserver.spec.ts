import { Logger } from '../utils/Logger';
import { NetworkObserver } from './NetworkObserver';
import type { NetworkRequest } from './NetworkRequest';
import type { NetworkObserverOptions } from './NetworkObserverOptions';
import type { RequestFilter } from './filters';
import type { Network } from './Network';
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
      /* eslint-disable @typescript-eslint/naming-convention */
      'Content-Length': '1777',
      'Content-Type': 'text/html; charset=UTF-8'
      /* eslint-enable @typescript-eslint/naming-convention */
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
          /* eslint-disable @typescript-eslint/naming-convention */
          'Upgrade-Insecure-Requests': '1'
          /* eslint-enable @typescript-eslint/naming-convention */
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
        // eslint-disable-next-line @typescript-eslint/naming-convention
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
  });
});
