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
  });
});
