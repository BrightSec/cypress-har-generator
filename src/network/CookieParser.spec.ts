import { CookieParser } from './CookieParser.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';

describe('CookieParser', () => {
  let parser: CookieParser;

  beforeEach(() => {
    parser = new CookieParser();
  });

  describe('parseCookie', () => {
    it('should handle cookie attributes', () => {
      // arrange
      const cookieHeader = 'key1=value1; $version=1';
      // act
      const result = parser.parseCookie(cookieHeader);
      // assert
      expect(result).toMatchObject([
        {
          name: 'key1',
          value: 'value1',
          size: 23
        }
      ]);
    });

    it('should return an array of cookies from a cookie header string', () => {
      // arrange
      const cookieHeader = 'key1=value1; key2=value2';

      // act
      const result = parser.parseCookie(cookieHeader);

      // assert
      expect(result).toMatchObject([
        { name: 'key1', value: 'value1' },
        { name: 'key2', value: 'value2' }
      ]);
    });
  });

  describe('parseSetCookie', () => {
    it('should handles cookies without a name', () => {
      // arrange
      const setCookieHeader = 'cookie1; Path=/; Domain=.example.com;';
      // act
      const result = parser.parseSetCookie(setCookieHeader);
      // assert
      expect(result).toMatchObject([
        {
          name: '',
          value: 'cookie1',
          path: '/',
          domain: '.example.com',
          size: 37
        }
      ]);
    });

    it('should handles cookies separated by line breaks', () => {
      // arrange
      const setCookieHeader = `a=b
      c=d
      f`;
      // act
      const result = parser.parseSetCookie(setCookieHeader);
      // assert
      expect(result).toMatchObject([
        { name: 'a', value: 'b', size: 10 },
        { name: 'c', value: 'd', size: 10 },
        { name: '', value: 'f', size: 1 }
      ]);
    });

    it('should return an array of cookies from a set-cookie header string', () => {
      // arrange
      const setCookieHeader =
        'key1=value1; Expires=Wed, 21 Oct 2021 07:28:00 GMT; Secure; HttpOnly';
      // act
      const result = parser.parseSetCookie(setCookieHeader);
      // assert
      expect(result).toMatchObject([
        {
          name: 'key1',
          value: 'value1',
          expires: 'Wed, 21 Oct 2021 07:28:00 GMT',
          secure: true,
          httpOnly: true
        }
      ]);
    });
  });
});
