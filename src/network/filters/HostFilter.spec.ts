import { NetworkRequest } from '../NetworkRequest.ts';
import { HostFilter } from './HostFilter.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('HostFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: HostFilter;

  beforeEach(() => {
    sut = new HostFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { includeHosts: undefined },
      { includeHosts: null },
      { includeHosts: [] }
    ])(
      'should return false when the filter is not applicable (options: %j)',
      options => {
        // act
        const result = sut.wouldApply(
          options as unknown as RequestFilterOptions
        );
        // assert
        expect(result).toBe(false);
      }
    );

    it.each([
      { includeHosts: ['example.com'] },
      { includeHosts: [/example\.com$/] },
      { includeHosts: ['example.com', 'sub.example.com'] }
    ])(
      'should return true when the filter is applicable (options: %j)',
      options => {
        // act
        const result = sut.wouldApply(
          options as unknown as RequestFilterOptions
        );
        // assert
        expect(result).toBe(true);
      }
    );
  });

  describe('apply', () => {
    it('should return true if the host is allowed', () => {
      // arrange
      const url = new URL('https://example.com');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { includeHosts: ['example.com'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return true if the host is allowed by regexp', () => {
      // arrange
      const url = new URL('https://example.com');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { includeHosts: [/example\.com$/] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false if the host is not allowed', () => {
      // arrange
      const url = new URL('https://example.com');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { includeHosts: ['google.com'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });

    it.each([
      'https://evil-example.com',
      'https://notexample.com',
      'https://example.com.attacker.net',
      'https://sub.example.com',
      'https://exampleXcom',
      'https://attacker.net/?example.com'
    ])(
      'should return false if the host only contains the host name (url: %s)',
      input => {
        // arrange
        when(networkRequestMock.parsedURL).thenReturn(new URL(input));
        const options = { includeHosts: ['example.com'] };
        // act
        const result = sut.apply(instance(networkRequestMock), options);
        // assert
        expect(result).toBe(false);
      }
    );

    it.each([
      { input: 'https://example.com', pattern: 'example.com' },
      { input: 'https://example.com:8443', pattern: 'example.com' },
      { input: 'http://localhost:8080/api', pattern: 'localhost' },
      { input: 'https://EXAMPLE.com', pattern: 'Example.COM' },
      { input: 'http://localhost:8080', pattern: 'localhost:8080' },
      { input: 'http://127.0.0.1:8080', pattern: '127.0.0.1' },
      { input: 'http://[::1]:8080', pattern: '[::1]' },
      { input: 'http://[::1]:8080', pattern: '[::1]:8080' },
      { input: 'https://my_host.local', pattern: 'my_host.local' }
    ])(
      'should return true if the host name equals the pattern (url: $input, pattern: $pattern)',
      ({ input, pattern }) => {
        // arrange
        when(networkRequestMock.parsedURL).thenReturn(new URL(input));
        const options = { includeHosts: [pattern] };
        // act
        const result = sut.apply(instance(networkRequestMock), options);
        // assert
        expect(result).toBe(true);
      }
    );

    it.each([
      { input: 'http://localhost:8081', pattern: 'localhost:8080' },
      { input: 'http://localhost', pattern: 'localhost:8080' },
      { input: 'http://[::2]:8080', pattern: '[::1]' },
      { input: 'http://1.1.1.1', pattern: '[::1]' }
    ])(
      'should return false if the host does not equal the pattern (url: $input, pattern: $pattern)',
      ({ input, pattern }) => {
        // arrange
        when(networkRequestMock.parsedURL).thenReturn(new URL(input));
        const options = { includeHosts: [pattern] };
        // act
        const result = sut.apply(instance(networkRequestMock), options);
        // assert
        expect(result).toBe(false);
      }
    );

    it.each([
      { input: 'https://api.example.com', pattern: '\\.example\\.com$' },
      { input: 'https://api.example.com', pattern: '^api\\.' },
      { input: 'https://api.example.com', pattern: '(?:example.com)' },
      { input: 'https://sub.example.com', pattern: /example\.com$/ },
      { input: 'https://evil-example.com', pattern: /example.com/ }
    ])(
      'should keep matching a regular expression as is (url: $input, pattern: $pattern)',
      ({ input, pattern }) => {
        // arrange
        when(networkRequestMock.parsedURL).thenReturn(new URL(input));
        const options = { includeHosts: [pattern] };
        // act
        const result = sut.apply(instance(networkRequestMock), options);
        // assert
        expect(result).toBe(true);
      }
    );

    it('should return true if any pattern matches', () => {
      // arrange
      when(networkRequestMock.parsedURL).thenReturn(
        new URL('https://api.example.com')
      );
      const options = { includeHosts: ['example.com', 'api.example.com'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });
  });
});
