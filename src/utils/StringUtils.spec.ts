import { StringUtils } from './StringUtils.ts';
import { describe, expect, it } from '@jest/globals';

describe('StringUtils', () => {
  describe('isString', () => {
    it.each([
      { input: 'test', expected: true },
      { input: '', expected: true },
      { input: 0, expected: false },
      { input: undefined, expected: false },
      { input: null, expected: false },
      { input: [], expected: false },
      { input: {}, expected: false },
      { input: Symbol.search, expected: false }
    ])(
      'should return $expected when value is $input',
      ({ input, expected }) => {
        // act
        const result = StringUtils.isString(input);
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('toRegexSource', () => {
    it.each([
      { input: 'test', expected: 'test' },
      { input: '', expected: '' },
      { input: /test/, expected: 'test' },
      { input: new RegExp(''), expected: '(?:)' }
    ])(
      'should return a copy of the text of the $input pattern',
      ({ input, expected }) => {
        // act
        const result = StringUtils.toRegexSource(input);
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('toRegex', () => {
    it.each([
      { input: 'test' },
      { input: '' },
      { input: /test/ },
      { input: new RegExp('test') }
    ])('should return an instance of the regular expression', ({ input }) => {
      // act
      const result = StringUtils.toRegex(input);
      // assert
      expect(result).toBeInstanceOf(RegExp);
    });
  });

  describe('globBase', () => {
    it.each([
      { pattern: 'cypress/e2e/**/*.cy.ts', expected: 'cypress/e2e/' },
      { pattern: './cypress/e2e/*.cy.{js,ts}', expected: 'cypress/e2e/' },
      { pattern: 'cypress\\e2e\\**\\*.cy.ts', expected: 'cypress/e2e/' },
      { pattern: 'cypress/e2e/login.cy.ts', expected: 'cypress/e2e/' },
      { pattern: 'src/{a,b}/**/*.cy.ts', expected: 'src/' },
      { pattern: '**/*.cy.ts', expected: '' },
      { pattern: 'login.cy.ts', expected: '' }
    ])(
      'should return $expected for the $pattern pattern',
      ({ pattern, expected }) => {
        // act
        const result = StringUtils.globBase(pattern);
        // assert
        expect(result).toBe(expected);
      }
    );
  });

  describe('dirname', () => {
    it('should return the directory name of a unix path', () => {
      const path = '/path/to/file.txt';
      const expectedResult = '/path/to';

      const result = StringUtils.dirname(path);

      expect(result).toEqual(expectedResult);
    });

    it('should return the directory name of a Window path', () => {
      const path = '\\path\\to\\file.txt';
      const expectedResult = '\\path\\to';

      const result = StringUtils.dirname(path);

      expect(result).toEqual(expectedResult);
    });

    it('should handle paths with trailing slashes correctly', () => {
      const path = '/path/to/file/';
      const expectedResult = '/path/to';

      const result = StringUtils.dirname(path);

      expect(result).toEqual(expectedResult);
    });

    it('should handle paths with trailing backslashes correctly', () => {
      const path = '\\path\\to\\file\\';
      const expectedResult = '\\path\\to';

      const result = StringUtils.dirname(path);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('normalizeName', () => {
    it('should return the name of the file with the specified extension', () => {
      const path = '/path/to/file.txt';
      const expectedResult = 'file.csv';

      const result = StringUtils.normalizeName(path, { ext: '.csv' });

      expect(result).toEqual(expectedResult);
    });

    it('should return the name of the file with the default extension if no extension is specified', () => {
      const path = '/path/to/file';
      const expectedResult = 'file.har';

      const result = StringUtils.normalizeName(path);

      expect(result).toEqual(expectedResult);
    });

    it('should handle paths with backslashes correctly', () => {
      const path = '\\path\\to\\file.txt';
      const expectedResult = 'file.csv';

      const result = StringUtils.normalizeName(path, { ext: '.csv' });

      expect(result).toEqual(expectedResult);
    });

    it('should handle paths that only contain a filename correctly', () => {
      const path = 'file.txt';
      const expectedResult = 'file.csv';

      const result = StringUtils.normalizeName(path, { ext: '.csv' });

      expect(result).toEqual(expectedResult);
    });
  });

  describe('escapeCharacters', () => {
    it('should escape all specified characters in the input string', () => {
      const str = 'abc^def[]ghi{}jkl()\\mno.$*+?|pqr';
      const chars = '^[]{}()\\\\.$*+?|';
      const expectedResult =
        'abc\\^def\\[\\]ghi\\{\\}jkl\\(\\)\\\\mno\\.\\$\\*\\+\\?\\|pqr';

      const result = StringUtils.escapeCharacters(str, chars);

      expect(result).toEqual(expectedResult);
    });

    it('should return the input string if it does not contain any of the specified characters', () => {
      const str = 'abcdefghijklmnopqr';
      const chars = '^[]{}()\\\\.$*+?|';

      const result = StringUtils.escapeCharacters(str, chars);

      expect(result).toEqual(str);
    });

    it('should escape all characters in the default set if no set is specified', () => {
      const str = 'abc^def[]ghi{}jkl()\\mno.$*+?|pqr';
      const expectedResult =
        'abc\\^def\\[\\]ghi\\{\\}jkl\\(\\)\\\\mno\\.\\$\\*\\+\\?\\|pqr';

      const result = StringUtils.escapeCharacters(str);

      expect(result).toEqual(expectedResult);
    });
  });
});
