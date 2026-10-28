import { NetworkRequest } from './NetworkRequest.ts';
import { DefaultHarExporter } from './DefaultHarExporter.ts';
import { HarBuilder } from './HarBuilder.ts';
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
import type { WriteStream } from 'node:fs';
import { open, rm, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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
    let file!: FileHandle;
    let path!: string;

    beforeEach(async () => {
      path = join(tmpdir(), `har-exporter-${randomUUID()}`);
      file = await open(path, 'w+');
    });

    afterEach(() => rm(path, { force: true }));

    const readAll = async (
      exporter: DefaultHarExporter
    ): Promise<Entry[] | undefined> => {
      const entries = await exporter.read();
      if (!entries) {
        return undefined;
      }

      const result: Entry[] = [];
      for await (const entry of entries) {
        result.push(JSON.parse(entry));
      }

      return result;
    };

    it('should return nothing when no entries are written', async () => {
      // arrange
      const sut = new DefaultHarExporter(instance(loggerMock), file);
      // act
      const result = await readAll(sut);
      // assert
      expect(result).toBeUndefined();
      sut.end();
    });

    it('should return the written entries sorted by startedDateTime, keeping the order of entries started at the same time', async () => {
      // arrange
      const startedAt: Record<string, string> = {
        'https://example.com/logo.png': '2022-04-18T09:09:35.705Z',
        'https://example.com/style.css': '2022-04-18T09:09:35.704Z',
        'https://example.com/app.js': '2022-04-18T09:09:35.705Z',
        'https://example.com/': '2022-04-18T09:09:35.585Z'
      };
      const sut = new DefaultHarExporter(instance(loggerMock), file, {
        transform: (entry: Entry): Entry => ({
          ...entry,
          startedDateTime: startedAt[entry.request.url]
        })
      });
      for (const url of Object.keys(startedAt)) {
        await sut.write(new NetworkRequest('1', url, url, '1'));
      }
      // act
      const result = await readAll(sut);
      // assert
      expect(result?.map(x => x.request.url)).toEqual([
        'https://example.com/',
        'https://example.com/style.css',
        'https://example.com/logo.png',
        'https://example.com/app.js'
      ]);
      sut.end();
    });

    it('should return entries with multibyte characters as written', async () => {
      // arrange
      const url = 'https://example.com/ŭ/€/😀';
      const sut = new DefaultHarExporter(instance(loggerMock), file);
      await sut.write(new NetworkRequest('1', url, url, '1'));
      await sut.write(new NetworkRequest('2', url, url, '1'));
      // act
      const result = await readAll(sut);
      // assert
      expect(result?.map(x => x.request.url)).toEqual([url, url]);
      sut.end();
    });

    describe('stable', () => {
      it('should write the entries without their times, in the order they started', async () => {
        // arrange
        const startedAt: Record<string, string> = {
          'https://example.com/b': '2022-04-18T09:09:35.705Z',
          'https://example.com/a': '2022-04-18T09:09:35.585Z'
        };
        const sut = new DefaultHarExporter(instance(loggerMock), file, {
          stable: true,
          transform: (entry: Entry): Entry => ({
            ...entry,
            startedDateTime: startedAt[entry.request.url],
            connection: '7'
          })
        });
        for (const url of Object.keys(startedAt)) {
          await sut.write(new NetworkRequest('1', url, url, '1'));
        }
        // act
        const result = await readAll(sut);
        // assert
        expect(
          result?.map(({ request, startedDateTime, time, connection }) => ({
            url: request.url,
            startedDateTime,
            time,
            connection
          }))
        ).toEqual(
          ['https://example.com/a', 'https://example.com/b'].map(url => ({
            url,
            startedDateTime: '1970-01-01T00:00:00.000Z',
            time: -1,
            connection: undefined
          }))
        );
        sut.end();
      });

      it('should pass the real times to the transform', async () => {
        // arrange
        transform.mockImplementation((entry: Entry): Entry => entry);
        const sut = new DefaultHarExporter(instance(loggerMock), file, {
          stable: true,
          transform
        });
        // act
        await sut.write(networkRequest);
        // assert
        expect(transform.mock.calls[0][0].time).not.toBe(-1);
        sut.end();
      });
    });

    describe('dedupe', () => {
      const url = 'https://example.com/api';
      const at = (ms: number): string => new Date(1e12 + ms).toISOString();

      // each request gets the given start time, a comment to tell it apart and, optionally, its body
      const createExporter = (
        requests: Record<
          string,
          { startedAt: number; method?: string; body?: string; ws?: boolean }
        >,
        { dedupe }: { dedupe?: boolean } = { dedupe: true }
      ) =>
        new DefaultHarExporter(instance(loggerMock), file, {
          dedupe,
          transform: (entry: Entry): Entry => {
            const id: string = new URL(entry.request.url).pathname.slice(1);
            const { startedAt, method, body, ws } = requests[id];

            return {
              ...entry,
              startedDateTime: at(startedAt),
              comment: id,
              request: {
                ...entry.request,
                url,
                method: method ?? 'GET',
                ...(body
                  ? { postData: { mimeType: 'application/json', text: body } }
                  : {})
              },
              ...(ws
                ? {
                    _webSocketMessages: [
                      { type: 'receive', time: startedAt, opcode: 1, data: id }
                    ]
                  }
                : {})
            };
          }
        });

      const request = (id: string): NetworkRequest =>
        new NetworkRequest(
          id,
          `https://example.com/${id}`,
          'https://example.com/',
          '1'
        );

      const writeAll = async (sut: DefaultHarExporter, ids: string[]) => {
        for (const id of ids) {
          await sut.write(request(id));
        }
      };

      it('should keep the first of the repeated requests', async () => {
        // arrange
        const sut = createExporter({
          first: { startedAt: 0 },
          second: { startedAt: 1 },
          third: { startedAt: 2 }
        });
        await writeAll(sut, ['first', 'second', 'third']);
        // act
        const result = await readAll(sut);
        // assert
        expect(result?.map(x => x.comment)).toEqual(['first']);
        sut.end();
      });

      it('should keep the repeat that started first when it is written last', async () => {
        // arrange
        const sut = createExporter({
          later: { startedAt: 5 },
          earlier: { startedAt: 1 }
        });
        await writeAll(sut, ['later', 'earlier']);
        // act
        const result = await readAll(sut);
        // assert
        expect(result?.map(x => x.comment)).toEqual(['earlier']);
        sut.end();
      });

      it('should keep the repeat that started first when both are written at once', async () => {
        // arrange
        const sut = createExporter({
          later: { startedAt: 5 },
          earlier: { startedAt: 1 }
        });
        await Promise.all(
          ['later', 'earlier'].map(id => sut.write(request(id)))
        );
        // act
        const result = await readAll(sut);
        // assert
        expect(result?.map(x => x.comment)).toEqual(['earlier']);
        sut.end();
      });

      it('should keep the requests that differ in method or body', async () => {
        // arrange
        const sut = createExporter({
          get: { startedAt: 0 },
          post: { startedAt: 1, method: 'POST', body: '{"a":1}' },
          other: { startedAt: 2, method: 'POST', body: '{"a":2}' },
          repeat: { startedAt: 3, method: 'POST', body: '{"a":1}' }
        });
        await writeAll(sut, ['get', 'post', 'other', 'repeat']);
        // act
        const result = await readAll(sut);
        // assert
        expect(result?.map(x => x.comment)).toEqual(['get', 'post', 'other']);
        sut.end();
      });

      it('should keep every WebSocket entry with frames', async () => {
        // arrange
        const sut = createExporter({
          first: { startedAt: 0, ws: true },
          second: { startedAt: 1, ws: true }
        });
        await writeAll(sut, ['first', 'second']);
        // act
        const result = await readAll(sut);
        // assert
        expect(result?.map(x => x.comment)).toEqual(['first', 'second']);
        sut.end();
      });

      it.each([false, undefined])(
        'should keep the repeated requests when dedupe is %p',
        async dedupe => {
          // arrange
          const sut = createExporter(
            { first: { startedAt: 0 }, second: { startedAt: 1 } },
            { dedupe }
          );
          await writeAll(sut, ['first', 'second']);
          // act
          const result = await readAll(sut);
          // assert
          expect(result?.map(x => x.comment)).toEqual(['first', 'second']);
          sut.end();
        }
      );
    });

    it('should wait for the entries being written', async () => {
      // arrange
      let flush: (() => void) | undefined;
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => (flush = callback)
      );
      const write = harExporter.write(networkRequest);
      while (!flush) {
        await new Promise(resolve => setImmediate(resolve));
      }

      // act
      let done = false;
      const read = harExporter.read().then(() => (done = true));
      await new Promise(resolve => setImmediate(resolve));

      // assert
      expect(done).toBe(false);
      flush?.();
      await Promise.all([write, read]);
      expect(done).toBe(true);
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
      verify(streamMock.write(anyString(), anyFunction())).once();
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
      verify(streamMock.write(anyString(), anyFunction())).once();
    });

    it('should transform the entry before writing to the buffer', async () => {
      // arrange
      const entry = { foo: 'bar' } as unknown as Entry;
      const entryString = HarBuilder.formatEntry(entry);
      when(streamMock.writable).thenReturn(true);
      when(streamMock.write(anyString(), anyFunction())).thenCall(
        (_, callback) => callback()
      );
      when(optionsSpy.transform).thenReturn(transform);
      transform.mockReturnValue(Promise.resolve(entry));

      // act
      await harExporter.write(networkRequest);

      // assert
      verify(streamMock.write(entryString, anyFunction())).once();
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
