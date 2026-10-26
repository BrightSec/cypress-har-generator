import { MinStatusCodeFilter } from './MinStatusCodeFilter.ts';
import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('MinStatusCodeFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: MinStatusCodeFilter;

  beforeEach(() => {
    sut = new MinStatusCodeFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { minStatusCodeToInclude: undefined },
      { minStatusCodeToInclude: null },
      { minStatusCodeToInclude: 'test' },
      { minStatusCodeToInclude: NaN }
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
      { minStatusCodeToInclude: 1 },
      { minStatusCodeToInclude: -1 },
      { minStatusCodeToInclude: 1.1 },
      { minStatusCodeToInclude: '1' }
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
    it('should return true if the request status code equals or is greater than the threshold', () => {
      // arrange
      const statusCode = 200;
      when(networkRequestMock.statusCode).thenReturn(statusCode);
      const options = { minStatusCodeToInclude: statusCode };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false if the request status code is less than the threshold', () => {
      // arrange
      const statusCode = 101;
      when(networkRequestMock.statusCode).thenReturn(statusCode);
      const options = { minStatusCodeToInclude: 200 };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });
  });
});
