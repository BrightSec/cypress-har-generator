import { NetworkRequest } from '../NetworkRequest.ts';
import { PathFilter } from './PathFilter.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('PathFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: PathFilter;

  beforeEach(() => {
    sut = new PathFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { excludePaths: undefined },
      { excludePaths: null },
      { excludePaths: [] }
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
      { excludePaths: ['example.com'] },
      { excludePaths: [/example\.com$/] },
      { excludePaths: ['example.com', 'sub.example.com'] }
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
    it('should return true when the pathname does not match pattern', () => {
      // arrange
      const url = new URL('https://example.com');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { excludePaths: ['/login'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return true when the pathname does not match regexp', () => {
      // arrange
      const url = new URL('https://example.com');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { excludePaths: [/\/login$/] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return true when the pathname does not match any patterns', () => {
      // arrange
      const url = new URL('https://example.com/path');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { excludePaths: ['/admin', '/login'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false when the pathname matches at least one pattern', () => {
      // arrange
      const url = new URL('https://example.com/admin');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { excludePaths: ['/admin', '/login'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });

    it('should return false when the pathname matches pattern', () => {
      // arrange
      const url = new URL('https://example.com/login');
      when(networkRequestMock.parsedURL).thenReturn(url);
      const options = { excludePaths: ['/login'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });
  });
});
