import { NetworkRequest } from './NetworkRequest';
import { DefaultHarExporter } from './DefaultHarExporter';
import type { Logger } from '../utils/Logger';
import type { DefaultHarExporterOptions } from './DefaultHarExporterOptions';
import {
  anyFunction,
  anyString,
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
import type { WriteStream } from 'node:fs';
import { EOL } from 'node:os';

describe('DefaultHarExporter', () => {
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

    harExporter = new DefaultHarExporter(
      instance(loggerMock),
      instance(streamMock),
      options
    );
  });

  afterEach(() => {
    predicate.mockRestore();
    transform.mockRestore();
    reset<DefaultHarExporterOptions | WriteStream | Logger>(
      streamMock,
      optionsSpy,
      loggerMock
    );
  });

  describe('path', () => {
    it('should return the path serializing buffer', () => {
      // arrange
      const expected = '/path/file';
      when(streamMock.path).thenReturn(Buffer.from(expected));

      // act
      const result = harExporter.path;

      // assert
      expect(result).toBe(expected);
    });

    it('should return the path', () => {
      // arrange
      const expected = '/path/file';
      when(streamMock.path).thenReturn(expected);

      // act
      const result = harExporter.path;

      // assert
      expect(result).toBe(expected);
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
