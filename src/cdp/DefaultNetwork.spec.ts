import { DefaultNetwork } from './DefaultNetwork';
import type { Logger } from '../utils/Logger';
import { TARGET_OR_BROWSER_CLOSED } from './messages';
import {
  anyFunction,
  anything,
  deepEqual,
  instance,
  match,
  mock,
  reset,
  verify,
  when
} from 'ts-mockito';
import type { Client } from 'chrome-remote-interface';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import type Protocol from 'devtools-protocol';

describe('DefaultNetwork', () => {
  const clientMock = mock<Client>();
  const loggerMock = mock<Logger>();
  const listener = jest.fn();

  let sut!: DefaultNetwork;

  beforeEach(() => {
    jest.useFakeTimers();
    sut = new DefaultNetwork(instance(clientMock), instance(loggerMock));
  });

  afterEach(() => {
    jest.useRealTimers();
    listener.mockReset();
    reset<Client | Logger>(clientMock, loggerMock);
  });

  describe('attachToTargets', () => {
    it('should listen to CDP events', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(clientMock.on('event', anyFunction())).once();
    });

    it('should pass only network events to the registered listener', async () => {
      const unexpectedEvent = {
        method: 'Security.certificateError',
        params: {
          eventId: 1,
          errorType: 'error',
          requestURL: 'http://example.com'
        }
      };
      const expectedEvent = {
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
      when(clientMock.on('event', anyFunction())).thenCall((_, callback) => {
        callback(unexpectedEvent);
        callback(expectedEvent);
        // ADHOC: spawn `setImmediate` immediately
        jest.runAllTimers();
      });
      // act
      await sut.attachToTargets(listener);
      // assert
      expect(listener).toHaveBeenNthCalledWith(1, expectedEvent);
    });

    it('should register a handle to ignore certificate errors', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(clientMock.on('Security.certificateError', anyFunction())).once();
      verify(clientMock.send('Security.enable')).once();
      verify(
        clientMock.send(
          'Security.setOverrideCertificateErrors',
          deepEqual({
            override: true
          })
        )
      ).once();
    });

    it('should ignore a error while subscribing to the security domain', async () => {
      // arrange
      when(clientMock.send('Security.enable')).thenReject(
        new Error('Something went wrong.')
      );
      // act
      const act = sut.attachToTargets(listener);
      // assert
      await expect(act).resolves.not.toThrow();
    });

    it('should listen to detached targets', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(clientMock.on('Target.detachedFromTarget', anyFunction())).once();
    });

    it('should start tracking sessions', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(clientMock.on('Network.requestWillBeSent', anyFunction())).once();
      verify(clientMock.on('Network.webSocketCreated', anyFunction())).once();
    });

    it('should attach to the root target', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(
        clientMock.send(
          'Target.setAutoAttach',
          deepEqual({
            autoAttach: true,
            flatten: true,
            waitForDebuggerOnStart: true
          }),
          undefined
        )
      ).once();
      verify(
        clientMock.send('Network.enable', deepEqual({}), undefined)
      ).never();
      verify(
        clientMock.send(
          'Network.setCacheDisabled',
          deepEqual({ cacheDisabled: true }),
          undefined
        )
      ).never();
      verify(clientMock.on('Target.attachedToTarget', anyFunction())).once();
    });

    it('should not listen to network events when attaching to the root target', async () => {
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(
        clientMock.send('Network.enable', deepEqual({}), undefined)
      ).never();
      verify(
        clientMock.send(
          'Network.setCacheDisabled',
          deepEqual({ cacheDisabled: true }),
          undefined
        )
      ).never();
    });

    it.each([{ input: 'tab' }, { input: 'browser' }, { input: 'other' }])(
      'should not listen to network events when attaching to the $input target',
      async ({ input }) => {
        // arrange
        const sessionId = '1';
        const targetInfo: Protocol.Target.TargetInfo = {
          targetId: '1',
          type: input,
          url: '',
          title: '',
          attached: true,
          canAccessOpener: false
        };
        let act!: (...args: unknown[]) => Promise<void>;
        when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
          (_, callback) => (act = callback)
        );
        await sut.attachToTargets(listener);
        // act
        await act({ sessionId, targetInfo, waitingForDebugger: false });
        // assert
        verify(
          clientMock.send('Network.enable', deepEqual({}), undefined)
        ).never();
        verify(
          clientMock.send(
            'Network.setCacheDisabled',
            deepEqual({ cacheDisabled: true }),
            undefined
          )
        ).never();
      }
    );

    it('should recursively attach to new targets', async () => {
      // arrange
      const sessionId = '1';
      const targetInfo: Protocol.Target.TargetInfo = {
        targetId: '1',
        type: 'page',
        url: '',
        title: '',
        attached: true,
        canAccessOpener: false
      };
      let act: ((...args: unknown[]) => Promise<void>) | undefined;
      when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
        (_, callback) => (act = callback)
      );
      await sut.attachToTargets(listener);
      // act
      await act?.({ sessionId, targetInfo, waitingForDebugger: false });
      // assert
      verify(
        clientMock.send(
          'Target.setAutoAttach',
          deepEqual({
            autoAttach: true,
            flatten: true,
            waitForDebuggerOnStart: true
          }),
          sessionId
        )
      ).once();
      verify(clientMock.on('Target.attachedToTarget', anyFunction())).once();
    });

    it.each([
      { input: 'service_worker' },
      { input: 'page' },
      { input: 'worker' },
      { input: 'background_page' },
      { input: 'webview' },
      { input: 'shared_worker' }
    ])(
      'should listen to network events when attaching to the $input target',
      async ({ input }) => {
        // arrange
        const sessionId = '1';
        const targetInfo: Protocol.Target.TargetInfo = {
          targetId: '1',
          type: input,
          url: '',
          title: '',
          attached: true,
          canAccessOpener: false
        };
        let act: ((...args: unknown[]) => Promise<void>) | undefined;
        when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
          (_, callback) => (act = callback)
        );
        await sut.attachToTargets(listener);
        // act
        await act?.(
          { sessionId, targetInfo, waitingForDebugger: false },
          'parent'
        );
        // assert
        verify(
          clientMock.send('Network.enable', deepEqual({}), sessionId)
        ).once();
        verify(
          clientMock.send(
            'Network.setCacheDisabled',
            deepEqual({ cacheDisabled: true }),
            sessionId
          )
        ).once();
      }
    );

    it('should release a service worker attached to the browser instead of tracking it twice', async () => {
      // arrange
      const sessionId = '1';
      const targetInfo: Protocol.Target.TargetInfo = {
        targetId: '1',
        type: 'service_worker',
        url: '',
        title: '',
        attached: true,
        canAccessOpener: false
      };
      let act: ((...args: unknown[]) => Promise<void>) | undefined;
      when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
        (_, callback) => (act = callback)
      );
      await sut.attachToTargets(listener);
      // act
      await act?.({ sessionId, targetInfo, waitingForDebugger: true });
      // assert
      verify(
        clientMock.send('Runtime.runIfWaitingForDebugger', undefined, sessionId)
      ).once();
      verify(
        clientMock.send('Target.detachFromTarget', deepEqual({ sessionId }))
      ).once();
      verify(clientMock.send('Network.enable', anything(), sessionId)).never();
    });

    it.each([{ input: true }, { input: false }])(
      'should resume the target when waitingForDebugger is $input',
      async ({ input }) => {
        // arrange
        const sessionId = '1';
        const targetInfo: Protocol.Target.TargetInfo = {
          targetId: '1',
          type: 'page',
          url: '',
          title: '',
          attached: true,
          canAccessOpener: false
        };
        let act: ((...args: unknown[]) => Promise<void>) | undefined;
        when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
          (_, callback) => (act = callback)
        );
        await sut.attachToTargets(listener);
        // act
        await act?.(
          { sessionId, targetInfo, waitingForDebugger: input },
          'parent'
        );
        // assert
        verify(
          clientMock.send(
            'Runtime.runIfWaitingForDebugger',
            undefined,
            sessionId
          )
        ).once();
      }
    );

    it('should resume a paused target without waiting for the network to be enabled', async () => {
      // arrange
      const sessionId = '1';
      const targetInfo: Protocol.Target.TargetInfo = {
        targetId: '1',
        type: 'service_worker',
        url: '',
        title: '',
        attached: true,
        canAccessOpener: false
      };
      let act: ((...args: unknown[]) => Promise<void>) | undefined;
      when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
        (_, callback) => (act = callback)
      );
      when(clientMock.send('Network.enable', anything(), sessionId)).thenReturn(
        new Promise(() => void 0)
      );
      await sut.attachToTargets(listener);
      // act
      void act?.({ sessionId, targetInfo, waitingForDebugger: true }, 'parent');
      // assert
      verify(
        clientMock.send('Runtime.runIfWaitingForDebugger', undefined, sessionId)
      ).once();
    });

    it('should not throw an error when an unexpected error is happened', async () => {
      // arrange
      const sessionId = '1';
      const targetInfo: Protocol.Target.TargetInfo = {
        targetId: '1',
        type: 'page',
        url: '',
        title: '',
        attached: true,
        canAccessOpener: false
      };
      let act: ((...args: unknown[]) => Promise<void>) | undefined;
      when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
        (_, callback) => (act = callback)
      );
      when(
        clientMock.send(
          'Runtime.runIfWaitingForDebugger',
          anything(),
          sessionId
        )
      ).thenReject(new Error('Something went wrong'));
      await sut.attachToTargets(listener);
      // act
      await act?.({ sessionId, targetInfo, waitingForDebugger: true });
      // assert
      verify(loggerMock.warn(match('Unable to attach to the target'))).once();
    });

    it.each([
      { input: 'Target closed' },
      { input: 'Session closed' },
      { input: 'Session with given id not found.' }
    ])(
      'should silently handle an error when the $input has been closed',
      async ({ input }) => {
        // arrange
        const sessionId = '1';
        const targetInfo: Protocol.Target.TargetInfo = {
          targetId: '1',
          type: 'page',
          url: '',
          title: '',
          attached: true,
          canAccessOpener: false
        };
        let act: ((...args: unknown[]) => Promise<void>) | undefined;
        when(clientMock.on('Target.attachedToTarget', anyFunction())).thenCall(
          (_, callback) => (act = callback)
        );
        when(
          clientMock.send('Network.enable', deepEqual({}), sessionId)
        ).thenReject(new Error(input));
        await sut.attachToTargets(listener);
        // act
        await act?.({ sessionId, targetInfo, waitingForDebugger: true });
        // assert
        verify(loggerMock.debug(TARGET_OR_BROWSER_CLOSED)).once();
      }
    );

    it('should ignore certificate errors', async () => {
      // arrange
      const eventId = 1;
      when(clientMock.on('Security.certificateError', anyFunction())).thenCall(
        (_, callback) => callback({ eventId })
      );
      // act
      await sut.attachToTargets(listener);
      // assert
      verify(clientMock.on('Security.certificateError', anyFunction())).once();
      verify(
        clientMock.send(
          'Security.handleCertificateError',
          deepEqual<Protocol.Security.HandleCertificateErrorRequest>({
            eventId,
            action: 'continue'
          })
        )
      ).once();
    });

    it.each([
      { input: 'Network.requestWillBeSent' },
      { input: 'Network.webSocketCreated' }
    ])(
      'should associate a session with a request on $input',
      async ({ input }) => {
        // arrange
        const requestId = '1';
        const sessionId = '2';
        when(clientMock.on(input, anyFunction())).thenCall((_, callback) =>
          callback({ requestId }, sessionId)
        );
        // act
        await sut.attachToTargets(listener);
        // assert
        verify(
          loggerMock.debug(
            match(`Session ${sessionId} associated with request: ${requestId}`)
          )
        ).once();
      }
    );

    it('should fail the open requests of a detached target', async () => {
      // arrange
      const sessionId = '2';
      let detach: ((...args: unknown[]) => void) | undefined;
      when(clientMock.on('event', anyFunction())).thenCall((_, callback) => {
        callback({
          method: 'Network.requestWillBeSent',
          params: { requestId: '1', timestamp: 1, type: 'Fetch' },
          sessionId
        });
        callback({
          method: 'Network.dataReceived',
          params: { requestId: '1', timestamp: 2 },
          sessionId
        });
        callback({
          method: 'Network.requestWillBeSent',
          params: { requestId: '3', timestamp: 1, type: 'Fetch' },
          sessionId
        });
        callback({
          method: 'Network.loadingFinished',
          params: { requestId: '3', timestamp: 2 },
          sessionId
        });
        callback({
          method: 'Network.requestWillBeSent',
          params: { requestId: '4', timestamp: 1, type: 'Fetch' },
          sessionId: '5'
        });
      });
      when(clientMock.on('Target.detachedFromTarget', anyFunction())).thenCall(
        (_, callback) => (detach = callback)
      );
      await sut.attachToTargets(listener);
      jest.runAllTimers();
      listener.mockClear();
      // act
      detach?.({ sessionId, targetId: '1' });
      jest.runAllTimers();
      // assert
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        sessionId,
        method: 'Network.loadingFailed',
        params: {
          requestId: '1',
          timestamp: 2,
          type: 'Fetch',
          errorText: 'net::ERR_ABORTED',
          canceled: true
        }
      });
    });

    it('should forget the sessions of a detached target', async () => {
      // arrange
      const requestId = '1';
      const sessionId = '2';
      let detach: ((...args: unknown[]) => void) | undefined;
      when(clientMock.on('Network.requestWillBeSent', anyFunction())).thenCall(
        (_, callback) => callback({ requestId }, sessionId)
      );
      when(clientMock.on('Target.detachedFromTarget', anyFunction())).thenCall(
        (_, callback) => (detach = callback)
      );
      await sut.attachToTargets(listener);
      // act
      detach?.({ sessionId, targetId: '1' });
      await sut.getResponseBody(requestId);
      // assert
      verify(
        clientMock.send(
          'Network.getResponseBody',
          deepEqual({ requestId }),
          undefined
        )
      ).once();
    });
  });

  describe('detachFromTargets', () => {
    it('should remove listeners when they are present', async () => {
      // arrange
      await sut.attachToTargets(listener);
      // act
      await sut.detachFromTargets();
      // assert
      verify(clientMock.off('event', anyFunction())).once();
      verify(clientMock.off('Security.certificateError', anyFunction())).once();
      verify(clientMock.off('Target.attachedToTarget', anyFunction())).once();
      verify(clientMock.off('Target.detachedFromTarget', anyFunction())).once();
      verify(clientMock.off('Network.requestWillBeSent', anyFunction())).once();
      verify(clientMock.off('Network.webSocketCreated', anyFunction())).once();
    });

    it('should not remove listeners when no subscription yet', async () => {
      // act
      await sut.detachFromTargets();
      // assert
      verify(clientMock.off('event', anyFunction())).never();
      verify(
        clientMock.off('Security.certificateError', anyFunction())
      ).never();
      verify(clientMock.off('Target.attachedToTarget', anyFunction())).never();
      verify(
        clientMock.off('Target.detachedFromTarget', anyFunction())
      ).never();
      verify(
        clientMock.off('Network.requestWillBeSent', anyFunction())
      ).never();
      verify(clientMock.off('Network.webSocketCreated', anyFunction())).never();
    });

    it('should ignore any errors while unsubscribing from the security domain', async () => {
      // arrange
      when(clientMock.send('Security.disable')).thenReject(
        new Error('Something went wrong.')
      );
      // act
      const act = sut.detachFromTargets();
      // assert
      await expect(act).resolves.not.toThrow();
    });

    it('should unsubscribe from the security domain', async () => {
      // act
      await sut.detachFromTargets();
      // assert
      verify(clientMock.send('Security.disable')).once();
    });

    it('should detach from the targets', async () => {
      // act
      await sut.detachFromTargets();
      // assert
      verify(
        clientMock.send(
          'Target.setAutoAttach',
          deepEqual({
            autoAttach: false,
            flatten: true,
            waitForDebuggerOnStart: true
          }),
          undefined
        )
      ).once();
    });
  });

  describe('getRequestBody', () => {
    it('should receive a request body for given request', async () => {
      // arrange
      const requestId = '1';
      const expected = {
        postData: 'test'
      };
      when(
        clientMock.send(
          'Network.getRequestPostData',
          deepEqual({ requestId }),
          anything() as string
        )
      ).thenResolve(expected);
      // act
      const result = await sut.getRequestBody(requestId);
      // assert
      expect(result).toMatchObject(expected);
    });
  });

  describe('getResponseBody', () => {
    it('should receive a request body for given request', async () => {
      // arrange
      const requestId = '1';
      const expected = {
        body: 'test',
        base64Encoded: false
      };
      when(
        clientMock.send(
          'Network.getResponseBody',
          deepEqual({ requestId }),
          anything() as string
        )
      ).thenResolve(expected);
      // act
      const result = await sut.getResponseBody(requestId);
      // assert
      expect(result).toMatchObject(expected);
    });
  });
});
