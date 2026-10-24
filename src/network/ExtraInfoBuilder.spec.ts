import { ExtraInfoBuilder } from './ExtraInfoBuilder.ts';
import { NetworkRequest } from './NetworkRequest.ts';
import type {
  RequestExtraInfo,
  ResponseExtraInfo
} from './ExtraInfoBuilder.ts';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { deepEqual, instance, mock, reset, verify, when } from 'ts-mockito';

describe('ExtraInfoBuilder', () => {
  const deleteCallback = jest.fn<() => void>();
  const requestMock = mock<NetworkRequest>();

  const requestExtraInfo = {
    requestHeaders: [{ name: 'foo', value: 'bar' }]
  } as RequestExtraInfo;
  const responseExtraInfo = {
    responseHeaders: [{ name: 'bar', value: 'baz' }]
  } as ResponseExtraInfo;

  let request!: NetworkRequest;
  let extraInfoBuilder!: ExtraInfoBuilder;

  beforeEach(() => {
    extraInfoBuilder = new ExtraInfoBuilder(deleteCallback);
    request = instance(requestMock);
  });

  afterEach(() => {
    deleteCallback.mockRestore();
    reset(requestMock);
  });

  describe('addRequest', () => {
    it('should add a request to the list of requests', () => {
      // act
      extraInfoBuilder.addRequest(request);
      // assert
      expect(deleteCallback).not.toHaveBeenCalled();
    });

    it('should add request extra info to the request if it is already present', () => {
      // arrange
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      // act
      extraInfoBuilder.addRequest(request);
      // assert
      verify(
        requestMock.addExtraRequestInfo(deepEqual(requestExtraInfo))
      ).once();
    });
  });

  describe('addRequestExtraInfo', () => {
    it('should add request extra info to the list of request extra info', () => {
      // act
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      // assert
      expect(deleteCallback).not.toHaveBeenCalled();
    });

    it('should do nothing when request is not added', () => {
      // act
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      // assert
      verify(
        requestMock.addExtraRequestInfo(deepEqual(requestExtraInfo))
      ).never();
    });

    it('should add request extra info to the request', () => {
      // arrange
      extraInfoBuilder.addRequest(request);
      // act
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      // assert
      verify(
        requestMock.addExtraRequestInfo(deepEqual(requestExtraInfo))
      ).once();
    });

    it('should flush changes and dispose extra info', () => {
      // arrange
      extraInfoBuilder.addRequest(request);
      extraInfoBuilder.finished();
      // act
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      // assert
      expect(deleteCallback).toHaveBeenCalled();
    });
  });

  describe('addResponseExtraInfo', () => {
    it('should add response extra info to the list of response extra info', () => {
      // act
      extraInfoBuilder.addResponseExtraInfo(responseExtraInfo);
      // assert
      expect(deleteCallback).not.toHaveBeenCalled();
    });

    it('should do nothing when request is not added', () => {
      // act
      extraInfoBuilder.addResponseExtraInfo(responseExtraInfo);
      // assert
      verify(
        requestMock.addExtraResponseInfo(deepEqual(responseExtraInfo))
      ).never();
    });

    it('should add response extra info to the request', () => {
      // arrange
      extraInfoBuilder.addRequest(request);
      // act
      extraInfoBuilder.addResponseExtraInfo(responseExtraInfo);
      // assert
      verify(
        requestMock.addExtraResponseInfo(deepEqual(responseExtraInfo))
      ).once();
    });

    it('should flush the request and dispose extra info', () => {
      // arrange
      extraInfoBuilder.addRequest(request);
      extraInfoBuilder.finished();
      // act
      extraInfoBuilder.addResponseExtraInfo(responseExtraInfo);
      // assert
      expect(deleteCallback).toHaveBeenCalled();
    });
  });

  describe('finished', () => {
    it('should flush the request when there is no extra info', () => {
      // arrange
      extraInfoBuilder.addRequest(request);
      // act
      extraInfoBuilder.finished();
      // assert
      expect(deleteCallback).toHaveBeenCalled();
    });

    it('should dot nothing when there is no extra response info', () => {
      // arrange
      when(requestMock.hasExtraResponseInfo).thenReturn(false);
      extraInfoBuilder.addRequestExtraInfo(requestExtraInfo);
      extraInfoBuilder.addRequest(request);
      // act
      extraInfoBuilder.finished();
      // assert
      expect(deleteCallback).not.toHaveBeenCalled();
    });
  });
});
