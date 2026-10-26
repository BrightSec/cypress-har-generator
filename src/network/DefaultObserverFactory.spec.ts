import type { NetworkObserverOptions } from './NetworkObserverOptions.ts';
import { DefaultObserverFactory } from './DefaultObserverFactory.ts';
import { Logger } from '../utils/Logger.ts';
import { NetworkObserver } from './NetworkObserver.ts';
import type { Network } from './Network.ts';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { instance, mock } from 'ts-mockito';

describe('DefaultObserverFactory', () => {
  const networkMock = mock<Network>();
  const loggerMock = mock<Logger>();
  const options: NetworkObserverOptions = {};

  let factory!: DefaultObserverFactory;

  beforeEach(() => {
    factory = new DefaultObserverFactory(instance(loggerMock));
  });

  describe('createNetworkObserver', () => {
    it('should create a NetworkObserver', () => {
      // act
      const observer = factory.createNetworkObserver(
        instance(networkMock),
        options
      );
      // assert
      expect(observer).toBeInstanceOf(NetworkObserver);
    });
  });
});
