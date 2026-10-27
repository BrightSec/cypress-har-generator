import { NetworkRequest } from '../NetworkRequest.ts';
import { BlobFilter } from './BlobFilter.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('BlobFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: BlobFilter;

  beforeEach(() => {
    sut = new BlobFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { includeBlobs: undefined },
      { includeBlobs: null },
      { includeBlobs: false }
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

    it('should return false when the filter is not applicable', () => {
      // act
      const result = sut.wouldApply({ includeBlobs: true });
      // assert
      expect(result).toBe(false);
    });
  });

  describe('apply', () => {
    it('should return false if the request is blob', () => {
      // arrange
      when(networkRequestMock.isBlob()).thenReturn(true);
      const options = { includeBlobs: false };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });

    it('should return true if the request is not blob', () => {
      // arrange
      when(networkRequestMock.isBlob()).thenReturn(false);
      const options = { includeBlobs: false };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });
  });
});
