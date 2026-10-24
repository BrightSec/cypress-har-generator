import { CookieAttribute, NetworkCookie } from './NetworkCookie.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';

describe('NetworkCookie', () => {
  let cookie: NetworkCookie;

  beforeEach(() => {
    cookie = new NetworkCookie('name', 'value');
  });

  describe('constructor', () => {
    it('should set the name and value', () => {
      expect(cookie.name).toBe('name');
      expect(cookie.value).toBe('value');
    });
  });

  describe('size', () => {
    it('should set the size', () => {
      // arrange
      const size = 100;
      // act
      cookie.size = size;
      // assert
      expect(cookie.size).toBe(size);
    });
  });

  describe('httpOnly', () => {
    it('should get the httpOnly flag', () => {
      // act
      cookie.addAttribute(CookieAttribute.HTTPONLY);
      // assert
      expect(cookie.httpOnly).toBe(true);
    });
  });

  describe('secure', () => {
    it('should get the secure flag', () => {
      // act
      cookie.addAttribute(CookieAttribute.SECURE);
      // assert
      expect(cookie.secure).toBe(true);
    });
  });

  describe('url', () => {
    it('should get URL with https schema', () => {
      // assert
      const url = new URL('https://example.com/users');
      cookie.addAttribute(CookieAttribute.SECURE);
      cookie.addAttribute(CookieAttribute.DOMAIN, url.host);
      cookie.addAttribute(CookieAttribute.PATH, url.pathname);
      // act
      const result = cookie.url;
      // assert
      expect(result).toBe(url.toString());
    });

    it('should get URL with http schema', () => {
      // assert
      const url = new URL('http://example.com/users');
      cookie.addAttribute(CookieAttribute.DOMAIN, url.host);
      cookie.addAttribute(CookieAttribute.PATH, url.pathname);
      // act
      const result = cookie.url;
      // assert
      expect(result).toBe(url.toString());
    });
  });

  describe('sameSite', () => {
    it('should get the sameSite flag', () => {
      // arrange
      const sameSite = 'Strict';
      // act
      cookie.addAttribute(CookieAttribute.SAMESITE, sameSite);
      // assert
      expect(cookie.sameSite).toBe(sameSite);
    });
  });

  describe('session', () => {
    it('should return false if maxAge is not present', () => {
      // act
      cookie.addAttribute(CookieAttribute.MAXAGE, '3600');
      // assert
      expect(cookie.session).toBe(false);
    });

    it('should return false if expires is not present', () => {
      cookie.addAttribute(CookieAttribute.EXPIRES, new Date().toISOString());
      expect(cookie.session).toBe(false);
    });
  });

  describe('path', () => {
    it('should get and set the path', () => {
      // arrange
      const path = '/path';
      // act
      cookie.addAttribute(CookieAttribute.PATH, path);
      // assert
      expect(cookie.path).toBe(path);
    });
  });

  describe('port', () => {
    it('should get and set the port', () => {
      // arrange
      const port = '8080';
      // act
      cookie.addAttribute(CookieAttribute.PORT, port);
      // assert
      expect(cookie.port).toBe(port);
    });
  });

  describe('domain', () => {
    it('should get and set the domain', () => {
      // arrange
      const domain = 'example.com';
      // act
      cookie.addAttribute(CookieAttribute.DOMAIN, domain);
      // assert
      expect(cookie.domain).toBe(domain);
    });
  });

  describe('expires', () => {
    it('should get and set the expires attribute', () => {
      // arrange
      const date = new Date().toISOString();
      // act
      cookie.addAttribute(CookieAttribute.EXPIRES, date);
      // assert
      expect(cookie.expires).toBe(date);
    });
  });

  describe('maxAge', () => {
    it('should get and set the maxAge attribute', () => {
      // arrange
      const maxAge = 3600;
      // act
      cookie.addAttribute(CookieAttribute.MAXAGE, maxAge.toString());
      // assert
      expect(cookie.maxAge).toBe(maxAge);
    });
  });

  describe('expiresDate', () => {
    it('should return correct date when maxAge is present', () => {
      // arrange
      const maxAge = 3600;
      cookie.addAttribute(CookieAttribute.MAXAGE, maxAge.toString());
      const input = new Date();
      const expected = new Date(input.getTime() + 1000 * maxAge);
      // act
      const result = cookie.expiresDate(input);
      // assert
      expect(result?.toJSON()).toBe(expected.toJSON());
    });

    it('should return correct date when expires is present', () => {
      // arrange
      const input = new Date();
      cookie.addAttribute(CookieAttribute.EXPIRES, input.toISOString());
      // act
      const result = cookie.expiresDate(input);
      // assert
      expect(result?.toJSON()).toBe(input.toJSON());
    });

    it('should return undefined when expires and maxAge are omitted', () => {
      // arrange
      const input = new Date();
      // act
      const result = cookie.expiresDate(input);
      // assert
      expect(result).toBeUndefined();
    });
  });
});
