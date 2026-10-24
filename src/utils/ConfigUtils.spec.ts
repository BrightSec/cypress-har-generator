import { type BrowserConfigSource, ConfigUtils } from './ConfigUtils';
import { describe, expect, it, jest } from '@jest/globals';

describe('ConfigUtils', () => {
  const keys = ['hars_folder', 'hars_folders'];

  const read =
    (values: Record<string, unknown>) =>
    (key: string): unknown =>
      values[key];

  describe('fromBrowser', () => {
    it('should return the exposed value', () => {
      // arrange
      const env = jest.fn(read({ hars_folder: 'env' }));
      const source: BrowserConfigSource = {
        expose: read({ hars_folder: 'expose' }),
        env,
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBe('expose');
      expect(env).not.toHaveBeenCalled();
    });

    it('should prefer the first key over the next one', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: read({ hars_folder: 'new', hars_folders: 'old' }),
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBe('new');
    });

    it('should return the value of the next key when the first is missing', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: read({ hars_folders: 'old' }),
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBe('old');
    });

    it('should prefer an exposed value of any key over an env value', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: read({ hars_folders: 'expose' }),
        env: read({ hars_folder: 'env' }),
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBe('expose');
    });

    it.each([{ key: 'hars_folder' }, { key: 'hars_folders' }])(
      'should fall back to the env value of $key when nothing is exposed',
      ({ key }) => {
        // arrange
        const source: BrowserConfigSource = {
          expose: () => undefined,
          env: read({ [key]: 'env' }),
          config: () => undefined
        };
        // act
        const result = ConfigUtils.fromBrowser(source, keys);
        // assert
        expect(result).toBe('env');
      }
    );

    it('should return the env value when expose is not supported', () => {
      // arrange
      const source: BrowserConfigSource = {
        env: read({ hars_folders: 'env' }),
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBe('env');
    });

    it('should not read env when it is disallowed', () => {
      // arrange
      const env = jest.fn(() => {
        throw new Error('Cypress.env() is not allowed');
      });
      const source: BrowserConfigSource = {
        expose: () => undefined,
        env,
        config: (name: string) =>
          name === 'allowCypressEnv' ? false : undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBeUndefined();
      expect(env).not.toHaveBeenCalled();
    });

    it('should return undefined when env is removed', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: () => undefined,
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBeUndefined();
    });

    it('should return undefined when env throws', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: () => undefined,
        env: () => {
          throw new Error('Cypress.env() has been removed');
        },
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, keys);
      // assert
      expect(result).toBeUndefined();
    });
  });

  describe('fromNode', () => {
    it.each([
      {
        source: {
          expose: { hars_folder: 'expose' },
          env: { hars_folder: 'env' }
        },
        expected: 'expose'
      },
      {
        source: { expose: { hars_folder: 'new', hars_folders: 'old' } },
        expected: 'new'
      },
      { source: { expose: { hars_folders: 'old' } }, expected: 'old' },
      {
        source: {
          expose: { hars_folders: 'expose' },
          env: { hars_folder: 'env' }
        },
        expected: 'expose'
      },
      { source: { expose: {}, env: { hars_folder: 'env' } }, expected: 'env' },
      { source: { env: { hars_folders: 'env' } }, expected: 'env' },
      { source: { expose: {}, env: {} }, expected: undefined },
      { source: {}, expected: undefined }
    ])(
      'should return $expected when source is $source',
      ({ source, expected }) => {
        // act
        const result = ConfigUtils.fromNode(source, keys);
        // assert
        expect(result).toBe(expected);
      }
    );
  });
});
