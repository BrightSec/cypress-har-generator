import { NetworkRequest } from '../NetworkRequest.ts';
import { MimeFilter } from './MimeFilter.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('MimeFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: MimeFilter;

  beforeEach(() => {
    sut = new MimeFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { includeMimes: undefined },
      { includeMimes: null },
      { includeMimes: [] }
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
      { includeMimes: ['application/json'] },
      { includeMimes: ['application/json', 'application/xml'] }
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
    it('should return true if the mime type is allowed', () => {
      // arrange
      const mimeType = 'application/json';
      when(networkRequestMock.mimeType).thenReturn(mimeType);
      const options = { includeMimes: [mimeType] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false if the mime type is not allowed', () => {
      // arrange
      const mimeType = 'application/json';
      when(networkRequestMock.mimeType).thenReturn(mimeType);
      const options = { includeMimes: ['text/plain'] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });
  });
});
