import { Loader } from './Loader';
import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

describe('Loader', () => {
  const modulePath = './exampleModule';
  const module = 'example export';

  afterEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  describe('load', () => {
    it('should load the module from the given path using the default export', async () => {
      // arrange
      jest.mock(
        modulePath,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        () => ({ __esModule: true, default: module }),
        { virtual: true }
      );

      // act
      const result = await Loader.load<string>(modulePath);

      // assert
      expect(result).toBe(module);
    });

    it.each(['ERR_REQUIRE_ESM', 'ERR_REQUIRE_ASYNC_MODULE'])(
      'should import the es module from the given path when require fails with %s',
      async code => {
        // arrange
        const path = resolve('/fixtures/we#ird %20/filter.mjs');
        jest.doMock(
          path,
          () => {
            throw new Error(`Error [${code}]: require() of ES Module`);
          },
          { virtual: true }
        );
        jest.doMock(
          pathToFileURL(path).href,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          () => ({ __esModule: true, default: module }),
          { virtual: true }
        );

        // act
        const result = await Loader.load<string>(path);

        // assert
        expect(result).toBe(module);
      }
    );

    it('should load the module from the given path using the default module.exports', async () => {
      // arrange
      jest.mock(modulePath, () => module, { virtual: true });

      // act
      const result = await Loader.load<string>(modulePath);

      // assert
      expect(result).toBe(module);
    });
  });
});
