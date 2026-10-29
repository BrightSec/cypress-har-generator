import type { CDPConnection } from './CDPConnection.ts';
import { Logger } from '../utils/Logger.ts';
import { RetryStrategy } from './RetryStrategy.ts';
import {
  CONNECTED,
  CONNECTION_NOT_ESTABLISHED,
  DISCONNECTED,
  FAILED_ATTEMPT_TO_CONNECT
} from './messages.ts';
import type { CDPClient } from './CDPClient.ts';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { anyFunction, instance, mock, reset, verify, when } from 'ts-mockito';
import type { Client, Options, VersionResult } from 'chrome-remote-interface';

const resolvableInstance = <T extends object>(m: T): T =>
  new Proxy<T>(instance(m), {
    get(target, prop, receiver) {
      if (
        ['Symbol(Symbol.toPrimitive)', 'then', 'catch'].includes(
          prop.toString()
        )
      ) {
        return undefined;
      }

      return Reflect.get(target, prop, receiver);
    }
  });

type CDP = {
  (options?: Options): Promise<Client>;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Version(options?: Options): Promise<VersionResult>;
};

describe('CDPConnection', () => {
  const loggerMock = mock<Logger>();
  const retryStrategyMock = mock<RetryStrategy>();
  const clientMock = mock<CDPClient>();
  const version = jest.fn<(options?: Options) => Promise<VersionResult>>();
  const connect = jest.fn<CDP>();
  const webSocketDebuggerUrl = 'ws://localhost:9222/devtools/browser/1';
  const options: Options = { host: 'localhost', port: 9222 };

  let sut!: CDPConnection;

  beforeEach(async () => {
    jest.unstable_mockModule('chrome-remote-interface', () => ({
      default: connect,
      Version: version
    }));
    sut = new (await import('./CDPConnection.ts')).CDPConnection(
      options,
      instance(loggerMock),
      instance(retryStrategyMock)
    );
  });

  afterEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    reset<Logger | RetryStrategy | CDPClient>(
      loggerMock,
      retryStrategyMock,
      clientMock
    );
  });

  describe('open', () => {
    beforeEach(() => {
      version.mockResolvedValue({
        webSocketDebuggerUrl
      } as VersionResult);
    });

    it('should attempt to connect to Chrome', async () => {
      // arrange
      connect.mockResolvedValue(resolvableInstance(clientMock));
      // act
      await sut.open();
      // assert
      expect(connect).toHaveBeenCalledWith({ target: webSocketDebuggerUrl });
    });

    it('should log a message if the connection is successful', async () => {
      // arrange
      connect.mockResolvedValue(resolvableInstance(clientMock));
      // act
      await sut.open();
      // assert
      verify(loggerMock.debug(CONNECTED)).once();
    });

    it('should log a message if the connection fails', async () => {
      // arrange
      const error = new Error('Connection failed');
      connect.mockRejectedValue(error);
      // act
      const act = () => sut.open();
      // assert
      await expect(act).rejects.toThrow();
      verify(loggerMock.debug(FAILED_ATTEMPT_TO_CONNECT, error)).once();
    });

    it('should keep the last connection error as the cause', async () => {
      // arrange
      const error = new Error('Connection failed');
      connect.mockRejectedValue(error);
      // act
      const act = () => sut.open();
      // assert
      await expect(act).rejects.toMatchObject({
        message: expect.stringMatching(/Connection failed$/),
        cause: error
      });
    });

    it('should retry the connection if it fails', async () => {
      // arrange
      const error = new Error('Connection failed');
      connect
        .mockRejectedValueOnce(error)
        .mockResolvedValue(resolvableInstance(clientMock));
      when(retryStrategyMock.execute(anyFunction())).thenCall(
        async callback => {
          await callback();

          return 1;
        }
      );
      // act
      await sut.open();
      // assert
      verify(retryStrategyMock.execute(anyFunction())).once();
      expect(connect).toHaveBeenCalledTimes(2);
    });

    it('should throw an error if the connection fails after the maximum number of retries', async () => {
      // arrange
      const error = new Error('Connection failed');
      connect.mockRejectedValue(error);
      when(retryStrategyMock.execute(anyFunction())).thenResolve(0);
      // act
      const act = () => sut.open();
      // assert
      await expect(act).rejects.toThrow('Failed to connect');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      connect.mockResolvedValue(resolvableInstance(clientMock));
      version.mockResolvedValue({
        webSocketDebuggerUrl
      } as VersionResult);
      await sut.open();
    });

    it('should close the connection', async () => {
      // act
      await sut.close();
      // assert
      verify(clientMock.close()).once();
    });

    it('should log a message if the connection is closed', async () => {
      // act
      await sut.close();
      // assert
      verify(loggerMock.debug(DISCONNECTED)).once();
    });

    it('should remove all listeners', async () => {
      // act
      await sut.close();
      // assert
      verify(clientMock.removeAllListeners()).once();
    });

    it('should not wait for the closing handshake', async () => {
      // arrange
      when(clientMock.close()).thenReturn(new Promise(() => void 0));
      // act
      const act = sut.close();
      // assert
      await expect(act).resolves.toBeUndefined();
    });
  });

  describe('discoverNetwork', () => {
    beforeEach(async () => {
      connect.mockResolvedValue(resolvableInstance(clientMock));
      version.mockResolvedValue({
        webSocketDebuggerUrl
      } as VersionResult);
    });

    it('should throw an error when connection is not established yet', async () => {
      // act
      const act = () => sut.discoverNetwork();
      // assert
      expect(act).toThrow(CONNECTION_NOT_ESTABLISHED);
    });

    it('should create a new network monitor', async () => {
      // arrange
      await sut.open();
      // act
      const result = sut.discoverNetwork();
      // assert
      expect(result).not.toBeUndefined();
    });

    it('should return an existing network monitor', async () => {
      // arrange
      await sut.open();
      const expected = sut.discoverNetwork();
      // act
      const result = sut.discoverNetwork();
      // assert
      expect(result).toBe(expected);
    });
  });
});
