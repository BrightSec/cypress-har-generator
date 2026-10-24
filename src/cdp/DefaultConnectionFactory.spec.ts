import { Logger } from '../utils/Logger.ts';
import { RetryStrategy } from './RetryStrategy.ts';
import { DefaultConnectionFactory } from './DefaultConnectionFactory.ts';
import { CDPConnection } from './CDPConnection.ts';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { instance, mock } from 'ts-mockito';

describe('DefaultConnectionFactory', () => {
  const loggerMock = mock<Logger>();
  const options = {
    port: 1,
    host: 'localhost',
    retryStrategy: new RetryStrategy(1, 1, 1000)
  };

  let factory!: DefaultConnectionFactory;

  beforeEach(() => {
    factory = new DefaultConnectionFactory(instance(loggerMock));
  });

  describe('create', () => {
    it('should create a connection', () => {
      // act
      const connection = factory.create(options);
      // assert
      expect(connection).toBeInstanceOf(CDPConnection);
    });
  });
});
