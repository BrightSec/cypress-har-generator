import { NetworkRequest } from '../NetworkRequest.ts';
import { StatusCodeFilter } from './StatusCodeFilter.ts';
import type { RequestFilterOptions } from './RequestFilter.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

describe('StatusCodeFilter', () => {
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: StatusCodeFilter;

  beforeEach(() => {
    sut = new StatusCodeFilter();
  });

  afterEach(() => reset(networkRequestMock));

  describe('wouldApply', () => {
    it.each([
      {},
      { excludeStatusCodes: undefined },
      { excludeStatusCodes: null },
      { excludeStatusCodes: [] }
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
      { excludeStatusCodes: [200] },
      { excludeStatusCodes: [200, 201] }
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
    it('should return true if the request status code is not in exclusions', () => {
      // arrange
      when(networkRequestMock.statusCode).thenReturn(200);
      const options = { excludeStatusCodes: [400] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false if the request status code is in exclusions', () => {
      // arrange
      const statusCode = 200;
      when(networkRequestMock.statusCode).thenReturn(statusCode);
      const options = { excludeStatusCodes: [statusCode] };
      // act
      const result = sut.apply(instance(networkRequestMock), options);
      // assert
      expect(result).toBe(false);
    });
  });
});
