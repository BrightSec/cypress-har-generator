import type { RecordOptions, SaveOptions } from './Plugin.ts';
import { Plugin } from './Plugin.ts';
import type { Logger } from './utils/Logger.ts';
import type { FileManager } from './utils/FileManager.ts';
import type { Observer } from './network/Observer.ts';
import type { ObserverFactory } from './network/ObserverFactory.ts';
import type { HarExporter } from './network/HarExporter.ts';
import type { HarExporterFactory } from './network/HarExporterFactory.ts';
import { NetworkRequest } from './network/NetworkRequest.ts';
import type { Connection } from './cdp/Connection.ts';
import type { ConnectionFactory } from './cdp/ConnectionFactory.ts';
import {
  anyFunction,
  anyString,
  anything,
  capture,
  deepEqual,
  instance,
  match,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Entry } from 'har-format';
import { tmpdir } from 'node:os';

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

const findArg = <R>(
  args: [unknown, unknown],
  expected: 'function' | 'number'
): R => (typeof args[0] === expected ? args[0] : args[1]) as R;

const useFakeTimers = () => {
  jest.useFakeTimers();

  const mockedImplementation = jest
    .spyOn(global, 'setTimeout')
    .getMockImplementation();

  jest
    .spyOn(global, 'setTimeout')
    .mockImplementation((...args: [unknown, unknown]) => {
      // ADHOC: depending on implementation (promisify vs raw), the method signature will be different
      const callback = findArg<(..._: unknown[]) => void>(args, 'function');
      const ms = findArg<number>(args, 'number');
      const timer = mockedImplementation?.(callback, ms);

      jest.runAllTimers();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return timer!;
    });
};

const entriesOf = async function* (
  ...entries: string[]
): AsyncGenerator<string> {
  yield* entries;
};

const entry = {
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
} as Entry;

const electron = {
  family: 'chromium',
  name: 'electron'
} as Cypress.Browser;

const chrome = { family: 'chromium', name: 'chrome' } as Cypress.Browser;
const firefox = { family: 'webkit', name: 'firefox' } as Cypress.Browser;

describe('Plugin', () => {
  const loggerMock = mock<Logger>();
  const fileManagerMock = mock<FileManager>();
  const observerFactoryMock = mock<ObserverFactory>();
  const networkObserverMock = mock<Observer<NetworkRequest>>();
  const connectionFactoryMock = mock<ConnectionFactory>();
  const harExporterFactoryMock = mock<HarExporterFactory>();
  const harExporterMock = mock<HarExporter>();
  const connectionMock = mock<Connection>();
  const processEnv = process.env;

  let plugin!: Plugin;
  let processSpy!: NodeJS.Process;

  beforeEach(() => {
    processSpy = spy(process);

    when(processSpy.env).thenReturn({
      ...processEnv,
      ELECTRON_EXTRA_LAUNCH_ARGS: ''
    });

    useFakeTimers();

    plugin = new Plugin(
      instance(loggerMock),
      instance(fileManagerMock),
      instance(connectionFactoryMock),
      instance(observerFactoryMock),
      instance(harExporterFactoryMock)
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    reset<
      | NodeJS.Process
      | Logger
      | FileManager
      | Connection
      | ConnectionFactory
      | ObserverFactory
      | Observer<NetworkRequest>
      | HarExporter
      | HarExporterFactory
    >(
      processSpy,
      loggerMock,
      fileManagerMock,
      connectionMock,
      connectionFactoryMock,
      observerFactoryMock,
      networkObserverMock,
      harExporterFactoryMock,
      harExporterMock
    );
  });

  describe('ensureBrowserFlags', () => {
    it('should add --remote-debugging-port and --remote-debugging-address flags if not present', () => {
      // arrange
      const args = ['--flag1', '--flag2'];
      const expectedArgs = [
        '--remote-debugging-address=localhost',
        expect.stringMatching(/^--remote-debugging-port/)
      ];
      // act
      const result = plugin.ensureBrowserFlags(chrome, args);
      // assert
      expect(result).toEqual(expect.arrayContaining(expectedArgs));
    });

    it('should not add --remote-debugging-port and --remote-debugging-address flags if present', () => {
      // arrange
      const expectedArgs = [
        '--remote-debugging-port=9090',
        '--remote-debugging-address=localhost'
      ];
      const args = ['--flag1', '--flag2', ...expectedArgs];
      // act
      const result = plugin.ensureBrowserFlags(chrome, args);
      // assert
      expect(result).not.toContain(expectedArgs);
    });

    it('should log a warning if an unsupported browser family is used', () => {
      // arrange
      const args = ['--flag1', '--flag2'];
      // act
      plugin.ensureBrowserFlags(firefox, args);
      // assert
      verify(
        loggerMock.warn(
          `HAR recording is not supported in this browser: ${firefox.name}`
        )
      ).once();
    });

    it('should throw an error when Electron is used and switches are missed', () => {
      // arrange
      const args: string[] = [];
      // act
      const act = () => plugin.ensureBrowserFlags(electron, args);
      // assert
      expect(act).toThrow(
        `Missing '--remote-debugging-port' command line switch for Electron browser`
      );
    });

    it('should extract --remote-debugging-port from ELECTRON_EXTRA_LAUNCH_ARGS env variable', () => {
      // arrange
      const args: string[] = [];
      when(processSpy.env).thenReturn({
        ...processEnv,
        ELECTRON_EXTRA_LAUNCH_ARGS: '--remote-debugging-port=9090'
      });
      // act
      const result = plugin.ensureBrowserFlags(electron, args);
      // assert
      expect(result).toEqual([]);
    });
  });

  describe('saveHar', () => {
    const options = {
      fileName: 'file.har',
      outDir: tmpdir()
    } as SaveOptions;

    it('should log an error message when the connection is corrupted', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.saveHar(options);
      // assert
      verify(
        loggerMock.err('Failed to save HAR. First you should start recording.')
      ).once();
    });

    it('should create an output folder', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      // act
      await plugin.saveHar(options);
      // assert
      verify(fileManagerMock.createFolder(options.outDir)).once();
    });

    it('should wait for completing all pending requests before saving a HAR', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(networkObserverMock.empty).thenReturn(false, false, true);
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenResolve(
        entriesOf(JSON.stringify(entry))
      );
      // act
      await plugin.saveHar({
        ...options,
        waitForIdle: true
      });
      // assert
      verify(networkObserverMock.empty).times(4);
    });

    it('should build and save a resulting HAR file', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenResolve(
        entriesOf(JSON.stringify(entry))
      );
      // act
      await plugin.saveHar(options);
      // assert
      const [path, content]: [string, unknown] = capture<string, unknown>(
        fileManagerMock.writeFile
      ).last();
      let har = '';
      for await (const chunk of content as AsyncIterable<string>) {
        har += chunk;
      }
      expect(path).toMatch(options.fileName);
      expect(JSON.parse(har)).toMatchObject({
        log: { version: '1.2', entries: [entry] }
      });
    });

    it('should stop observing the network before building a HAR file', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenResolve(
        entriesOf(JSON.stringify(entry))
      );
      // act
      await plugin.saveHar(options);
      // assert
      verify(networkObserverMock.unsubscribe()).calledBefore(
        harExporterMock.read()
      );
    });

    it('should log an error message when failing to build a HAR file', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenReject(
        new Error('something went wrong')
      );
      // act
      await plugin.saveHar(options);
      // assert
      verify(
        loggerMock.err(
          match(/^An error occurred while attempting to save the HAR file/)
        )
      ).once();
    });

    it('should unsubscribe from the network events', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      // act
      await plugin.saveHar(options);
      // assert
      verify(networkObserverMock.unsubscribe()).once();
    });

    it('should stop observing the network before reading the recorded entries', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenResolve(
        entriesOf(JSON.stringify(entry))
      );
      // act
      await plugin.saveHar(options);
      // assert
      verify(networkObserverMock.unsubscribe()).calledBefore(
        harExporterMock.read()
      );
    });

    it('should dispose a exporter', async () => {
      // arrange
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      when(harExporterMock.read()).thenResolve(
        entriesOf(JSON.stringify(entry))
      );
      // act
      await plugin.saveHar(options);
      // assert
      verify(harExporterMock.end()).once();
    });

    it('should be a no-op if an unsupported browser family is used', async () => {
      // arrange
      plugin.ensureBrowserFlags(firefox, []);
      await plugin.recordHar({
        rootDir: '/'
      });

      // act
      await plugin.saveHar(options);
      // assert
      verify(fileManagerMock.createFolder(options.outDir)).never();
    });
  });

  describe('recordHar', () => {
    const options = {
      content: true,
      excludePaths: [],
      includeHosts: [],
      rootDir: '/'
    } as RecordOptions;

    beforeEach(() => {
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
    });

    it('should open connection and listen to network events', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.recordHar(options);
      // assert
      verify(
        observerFactoryMock.createNetworkObserver(
          anything(),
          deepEqual(options)
        )
      ).once();
      verify(connectionMock.open()).once();
      verify(networkObserverMock.subscribe(anyFunction())).once();
    });

    it('should warn that minStatusCodeToInclude is deprecated', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.recordHar({
        ...options,
        includeBlobs: true,
        minStatusCodeToInclude: 400
      });
      // assert
      verify(
        loggerMock.deprecate('minStatusCodeToInclude', anyString())
      ).once();
      verify(loggerMock.deprecate('includeBlobs', anyString())).never();
    });

    it('should warn that the includeBlobs default changes when it is not set', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.recordHar(options);
      // assert
      verify(loggerMock.deprecate('includeBlobs', anyString())).once();
      verify(
        loggerMock.deprecate('minStatusCodeToInclude', anyString())
      ).never();
    });

    it('should throw an error when the addr is not defined', async () => {
      // act
      const act = () => plugin.recordHar(options);
      // assert
      await expect(act).rejects.toThrow(
        "Please call the 'ensureBrowserFlags' before attempting to start the recording."
      );
    });

    it('should close connection when it is already opened', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar(options);
      // act
      await plugin.recordHar(options);
      // assert
      verify(connectionMock.close()).once();
      verify(connectionMock.open()).twice();
    });

    it('should dispose of the previous recording when it is already started', async () => {
      // arrange
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar(options);
      // act
      await plugin.recordHar(options);
      // assert
      verify(harExporterMock.end()).once();
    });

    it('should pass an entry to a exporter', async () => {
      // arrange
      const request = new NetworkRequest(
        '1',
        'https://example.com',
        'https://example.com',
        '1'
      );
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      when(networkObserverMock.subscribe(anyFunction())).thenCall(callback =>
        callback(request)
      );
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.recordHar(options);
      // assert
      verify(harExporterMock.write(request)).once();
    });

    it('should do nothing when a exporter is not defined', async () => {
      // arrange
      const request = new NetworkRequest(
        '1',
        'https://example.com',
        'https://example.com',
        '1'
      );
      when(networkObserverMock.subscribe(anyFunction())).thenCall(callback =>
        callback(request)
      );
      plugin.ensureBrowserFlags(chrome, []);
      // act
      await plugin.recordHar(options);
      // assert
      verify(harExporterMock.write(request)).never();
    });

    it('should be a no-op if an unsupported browser family is used', async () => {
      const request = new NetworkRequest(
        '1',
        'https://example.com',
        'https://example.com',
        '1'
      );
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
      when(networkObserverMock.subscribe(anyFunction())).thenCall(callback =>
        callback(request)
      );
      plugin.ensureBrowserFlags(firefox, []);
      // act
      await plugin.recordHar(options);
      // assert
      verify(harExporterMock.write(request)).never();
    });
  });

  describe('disposeOfHar', () => {
    beforeEach(() => {
      when(connectionFactoryMock.create(anything())).thenReturn(
        instance(connectionMock)
      );
      when(
        observerFactoryMock.createNetworkObserver(anything(), anything())
      ).thenReturn(instance(networkObserverMock));
      when(harExporterFactoryMock.create(anything())).thenResolve(
        resolvableInstance(harExporterMock)
      );
    });

    it('should dispose of a exporter', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });
      // act
      await plugin.disposeOfHar();
      // assert
      verify(harExporterMock.end()).once();
    });

    it('should unsubscribe from the network events', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });
      // act
      await plugin.disposeOfHar();
      // assert
      verify(networkObserverMock.unsubscribe()).once();
    });

    it('should close the connection', async () => {
      // arrange
      plugin.ensureBrowserFlags(chrome, []);
      await plugin.recordHar({
        rootDir: '/'
      });
      // act
      await plugin.disposeOfHar();
      // assert
      verify(connectionMock.close()).once();
    });

    it('should do nothing when the recording is not started yet', async () => {
      // act
      await plugin.disposeOfHar();
      // assert
      verify(networkObserverMock.unsubscribe()).never();
    });

    it('should be a no-op if an unsupported browser family is used', async () => {
      // arrange
      plugin.ensureBrowserFlags(firefox, []);
      await plugin.recordHar({
        rootDir: '/'
      });
      // act
      await plugin.disposeOfHar();
      // assert
      verify(harExporterMock.end()).never();
    });
  });
});
