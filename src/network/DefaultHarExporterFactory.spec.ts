import type { FileManager } from '../utils/FileManager.ts';
import { DefaultHarExporterFactory } from './DefaultHarExporterFactory.ts';
import { DefaultHarExporter } from './DefaultHarExporter.ts';
import { Loader } from '../utils/Loader.ts';
import type { Logger } from '../utils/Logger.ts';
import { instance, mock, reset, spy, verify, when } from 'ts-mockito';
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from '@jest/globals';
import type { FileHandle } from 'node:fs/promises';

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

describe('DefaultHarExporterFactory', () => {
  const fileManagerMock = mock<FileManager>();
  const fileMock = mock<FileHandle>();
  const loggerMock = mock<Logger>();
  const loaderSpy = spy(Loader);
  const predicate = jest.fn();
  const transform = jest.fn();

  let factory!: DefaultHarExporterFactory;

  beforeEach(() => {
    factory = new DefaultHarExporterFactory(
      instance(fileManagerMock),
      instance(loggerMock)
    );
  });

  afterEach(() => {
    transform.mockReset();
    predicate.mockReset();
    reset<FileManager | FileHandle | Logger | typeof Loader>(
      fileManagerMock,
      fileMock,
      loaderSpy,
      loggerMock
    );
  });

  describe('create', () => {
    it('should create a HarExporter instance', async () => {
      // arrange
      const options = {
        rootDir: '/root',
        filter: 'predicate.js',
        transform: 'transform.js'
      };
      when(fileManagerMock.createTmpFile()).thenResolve(
        resolvableInstance(fileMock)
      );
      when(loaderSpy.load('/root/predicate.js')).thenResolve(predicate);
      when(loaderSpy.load('/root/transform.js')).thenResolve(transform);

      // act
      const result = await factory.create(options);

      // assert
      expect(result).toBeInstanceOf(DefaultHarExporter);
      expect(result).toHaveProperty('options.transformPath', 'transform.js');
      verify(loaderSpy.load('/root/predicate.js')).once();
      verify(loaderSpy.load('/root/transform.js')).once();
    });

    it('should create a HarExporter instance without pre and post processors', async () => {
      // arrange
      const options = { rootDir: '/root' };
      when(fileManagerMock.createTmpFile()).thenResolve(
        resolvableInstance(fileMock)
      );

      // act
      const result = await factory.create(options);

      // assert
      expect(result).toBeInstanceOf(DefaultHarExporter);
    });

    it.each([
      { dedupe: undefined, expected: false },
      { dedupe: false, expected: false },
      { dedupe: true, expected: true }
    ])(
      'should create a HarExporter with dedupe $expected when dedupe is $dedupe',
      async ({ dedupe, expected }) => {
        // arrange
        when(fileManagerMock.createTmpFile()).thenResolve(
          resolvableInstance(fileMock)
        );

        // act
        const result = await factory.create({ dedupe, rootDir: '/root' });

        // assert
        expect(result).toHaveProperty('options.dedupe', expected);
      }
    );

    it.each([1, 'true', null])(
      'should throw a TypeError when dedupe is %j',
      async dedupe => {
        // act
        const act = () =>
          factory.create({
            dedupe: dedupe as unknown as boolean,
            rootDir: '/'
          });

        // assert
        await expect(act()).rejects.toThrow(TypeError);
        verify(fileManagerMock.createTmpFile()).never();
      }
    );
  });
});
