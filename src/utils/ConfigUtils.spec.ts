import { type BrowserConfigSource, ConfigUtils } from './ConfigUtils';
import { describe, expect, it, jest } from '@jest/globals';

describe('ConfigUtils', () => {
  const key = 'hars_folders';

  describe('fromBrowser', () => {
    it('should return the exposed value', () => {
      // arrange
      const env = jest.fn(() => 'env');
      const source: BrowserConfigSource = {
        expose: () => 'expose',
        env,
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, key);
      // assert
      expect(result).toBe('expose');
      expect(env).not.toHaveBeenCalled();
    });

    it('should fall back to the env value when the value is not exposed', () => {
      // arrange
      const source: BrowserConfigSource = {
        expose: () => undefined,
        env: () => 'env',
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, key);
      // assert
      expect(result).toBe('env');
    });

    it('should return the env value when expose is not supported', () => {
      // arrange
      const source: BrowserConfigSource = {
        env: () => 'env',
        config: () => undefined
      };
      // act
      const result = ConfigUtils.fromBrowser(source, key);
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
      const result = ConfigUtils.fromBrowser(source, key);
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
      const result = ConfigUtils.fromBrowser(source, key);
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
      const result = ConfigUtils.fromBrowser(source, key);
      // assert
      expect(result).toBeUndefined();
    });
  });

  describe('fromNode', () => {
    it.each([
      {
        source: { expose: { [key]: 'expose' }, env: { [key]: 'env' } },
        expected: 'expose'
      },
      { source: { expose: {}, env: { [key]: 'env' } }, expected: 'env' },
      { source: { env: { [key]: 'env' } }, expected: 'env' },
      { source: { expose: {}, env: {} }, expected: undefined },
      { source: {}, expected: undefined }
    ])(
      'should return $expected when source is $source',
      ({ source, expected }) => {
        // act
        const result = ConfigUtils.fromNode(source, key);
        // assert
        expect(result).toBe(expected);
      }
    );
  });
});
