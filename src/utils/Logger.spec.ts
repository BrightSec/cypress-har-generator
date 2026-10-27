import { Logger } from './Logger.ts';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import chalk from 'chalk';

describe('Logger', () => {
  let logSpy!: jest.SpiedFunction<(msg: string, ...args: unknown[]) => void>;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      /* noop */
    });
  });

  afterEach(() => logSpy.mockRestore());

  describe('info', () => {
    it('should log a blue message with an info symbol', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.blue(`ℹ️ ${message}`);

      // act
      Logger.Instance.info(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('err', () => {
    it('should log a red message with an error symbol', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.red(`🍑 ${message}`);

      // act
      Logger.Instance.err(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('warn', () => {
    it('should log a yellow message with a warning symbol', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.yellow(`⚠ ${message}`);

      // act
      Logger.Instance.warn(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('deprecate', () => {
    it('should warn only the first time for the same id', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.yellow(`⚠ ${message}`);

      // act
      Logger.Instance.deprecate('test-id', message);
      Logger.Instance.deprecate('test-id', message);

      // assert
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });
});
