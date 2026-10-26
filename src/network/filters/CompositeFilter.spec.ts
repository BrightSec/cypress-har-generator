import { CompositeFilter } from './CompositeFilter.ts';
import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter } from './RequestFilter.ts';
import { instance, mock, reset, verify, when } from 'ts-mockito';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('CompositeFilter', () => {
  const requestFilterMock = mock<RequestFilter>();
  const networkRequestMock = mock<NetworkRequest>();

  let sut!: CompositeFilter;

  beforeEach(() => {
    sut = new CompositeFilter([
      instance(requestFilterMock),
      instance(requestFilterMock)
    ]);
  });

  afterEach(() =>
    reset<NetworkRequest | RequestFilter>(requestFilterMock, networkRequestMock)
  );

  describe('wouldApply', () => {
    it('should return true if at least one child filter returns true', () => {
      // arrange
      const options = {};
      when(requestFilterMock.wouldApply(options)).thenReturn(true, false);
      // act
      const result = sut.wouldApply(options);
      // assert
      expect(result).toBe(true);
    });

    it('should return false if all children filters return true', () => {
      // arrange
      const options = {};
      when(requestFilterMock.wouldApply(options)).thenReturn(false, false);
      // act
      const result = sut.wouldApply(options);
      // assert
      expect(result).toBe(false);
    });
  });

  describe('apply', () => {
    it('should return true if all children filters return true', () => {
      // arrange
      const options = {};
      const request = instance(networkRequestMock);
      when(requestFilterMock.wouldApply(options)).thenReturn(true);
      when(requestFilterMock.apply(request, options)).thenReturn(true);
      // act
      const result = sut.apply(request, options);
      // assert
      expect(result).toBe(true);
      verify(requestFilterMock.apply(request, options)).twice();
    });

    it('should return false if at least one children filter returns false', () => {
      // arrange
      const options = {};
      const request = instance(networkRequestMock);
      when(requestFilterMock.wouldApply(options)).thenReturn(true, true);
      when(requestFilterMock.apply(request, options)).thenReturn(false, true);
      // act
      const result = sut.apply(request, options);
      // assert
      expect(result).toBe(false);
    });

    it('should return true if none of children filters are applicable', () => {
      // arrange
      const options = {};
      const request = instance(networkRequestMock);
      when(requestFilterMock.wouldApply(options)).thenReturn(false, false);
      // act
      const result = sut.apply(request, options);
      // assert
      expect(result).toBe(true);
    });
  });
});
