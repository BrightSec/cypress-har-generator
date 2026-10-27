import { NetworkRequest } from './NetworkRequest.ts';
import { DefaultHarExporter } from './DefaultHarExporter.ts';
import type { Logger } from '../utils/Logger.ts';
import type { DefaultHarExporterOptions } from './DefaultHarExporterOptions.ts';
import {
  anyFunction,
  anyString,
  anything,
  instance,
  match,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import type { Entry } from 'har-format';
import { beforeEach, describe, it, jest, expect } from '@jest/globals';
import type { Stats, WriteStream } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { EOL } from 'node:os';

describe('DefaultHarExporter', () => {
  const fileMock = mock<FileHandle>();
  const streamMock = mock<WriteStream>();
  const loggerMock = mock<Logger>();
  const networkRequest = new NetworkRequest(
    '1',
    'https://example.com',
    'https://example.com',
    '1'
  );
  const predicate = jest.fn<(entry: Entry) => Promise<unknown> | unknown>();
  const transform = jest.fn<(entry: Entry) => Promise<Entry> | Entry>();

  let harExporter!: DefaultHarExporter;
  let options!: DefaultHarExporterOptions;
  let optionsSpy!: DefaultHarExporterOptions;

  beforeEach(() => {
    options = {};
    optionsSpy = spy(options);
    when(fileMock.createWriteStream(anything())).thenReturn(
      instance(streamMock)
    );

    harExporter = new DefaultHarExporter(
      instance(loggerMock),
      instance(fileMock),
      options
    );
  });

  afterEach(() => {
    predicate.mockRestore();
    transform.mockRestore();
    reset<DefaultHarExporterOptions | FileHandle | WriteStream | Logger>(
      fileMock,
      streamMock,
      optionsSpy,
      loggerMock
    );
  });

  describe('read', () => {
    it('should read the whole file', async () => {
      // arrange
      const expected = 'entry';
      when(fileMock.stat()).thenResolve({ size: expected.length } as Stats);
      when(fileMock.read(anything(), 0, expected.length, 0)).thenCall(
        (buffer: Buffer) => {
          const bytesRead = buffer.write(expected);

          return Promise.resolve({ buffer, bytesRead });
        }
      );

      // act
      const result = await harExporter.read();

      // assert
      expect(result).toBe(expected);
    });

    it('should wait for the entries being written', async () => {
      // arrange
      let flush: (() => void) | undefined;
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => (flush = callback)
      );
      when(fileMock.stat()).thenResolve({ size: 0 } as Stats);
      when(fileMock.read(anything(), 0, 0, 0)).thenResolve({
        buffer: Buffer.alloc(0),
        bytesRead: 0
      });
      const write = harExporter.write(networkRequest);
      while (!flush) {
        await new Promise(resolve => setImmediate(resolve));
      }

      // act
      const read = harExporter.read();
      await new Promise(resolve => setImmediate(resolve));

      // assert
      verify(fileMock.stat()).never();
      flush?.();
      await Promise.all([write, read]);
      verify(fileMock.stat()).once();
    });
  });

  describe('end', () => {
    it('should close the stream', () => {
      // act
      harExporter.end();

      // assert
      verify(streamMock.end()).once();
    });
  });

  describe('write', () => {
    it('should write the entry to the buffer', async () => {
      // arrange
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.filter).thenReturn(predicate);
      predicate.mockReturnValue(false);

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(match(`${EOL}`), anyFunction())).once();
    });

    it('should write the entry to the buffer if the predicate returns throws an error', async () => {
      // arrange
      when(streamMock.writable).thenReturn(true);
      when(optionsSpy.filter).thenReturn(predicate);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      predicate.mockReturnValue(
        Promise.reject(new Error('something went wrong'))
      );

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(match(`${EOL}`), anyFunction())).once();
    });

    it('should transform the entry before writing to the buffer', async () => {
      // arrange
      const entry = { foo: 'bar' } as unknown as Entry;
      const entryString = JSON.stringify(entry);
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.transform).thenReturn(transform);
      transform.mockReturnValue(Promise.resolve(entry));

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(
        streamMock.write(match(`${entryString}${EOL}`), anyFunction())
      ).once();
    });

    it('should skip the entry when the transformation is failed with an error', async () => {
      // arrange
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.transform).thenReturn(transform);
      transform.mockReturnValue(
        Promise.reject(new Error('Something went wrong.'))
      );

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(anyString(), anyFunction())).never();
    });

    it('should warn once and skip the entries when the transformation returns no entry', async () => {
      // arrange
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.transform).thenReturn(transform);
      when(optionsSpy.transformPath).thenReturn('transform.js');
      transform.mockReturnValue(undefined as unknown as Entry);

      // act
      await harExporter.write(networkRequest);
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(anyString(), anyFunction())).never();
      verify(
        loggerMock.warn(
          match(/'transform.js' returned undefined.*return entry/)
        )
      ).once();
    });

    it('should not write the entry to the buffer if the predicate returns true', async () => {
      // arrange
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.filter).thenReturn(predicate);
      predicate.mockReturnValue(true);

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(anyString(), anyFunction())).never();
    });

    it('should not write the entry to the buffer if the buffer is not writable', async () => {
      // arrange
      when(streamMock.writable).thenReturn(false);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.filter).thenReturn(predicate);
      predicate.mockReturnValue(false);

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(anyString(), anyFunction())).never();
    });

    it('should not write the entry to the buffer if the buffer is ended while the entry is being processed', async () => {
      // arrange
      let ended = false;
      when(streamMock.closed).thenReturn(false);
      when(streamMock.writable).thenCall(() => !ended);
      when(streamMock.end()).thenCall(() => (ended = true));
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) =>
          callback(ended ? new Error('write after end') : undefined)
      );
      when(optionsSpy.transform).thenReturn(transform);
      transform.mockImplementation(entry => {
        harExporter.end();

        return entry;
      });

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(anyString(), anyFunction())).never();
    });
  });
});
