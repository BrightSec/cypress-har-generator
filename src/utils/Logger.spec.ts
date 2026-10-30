import { Logger } from './Logger.ts';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import chalk from 'chalk';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Logger', () => {
  let logSpy!: jest.SpiedFunction<(msg: string, ...args: unknown[]) => void>;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      /* noop */
    });
  });

  afterEach(() => logSpy.mockRestore());

  describe('info', () => {
    it('should log the message with the plugin name', () => {
      // arrange
      const message = 'Test message';

      // act
      Logger.Instance.info(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(`[cypress-har-generator] ${message}`);
    });
  });

  describe('err', () => {
    it('should log a red message with the plugin name', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.red(`[cypress-har-generator] ${message}`);

      // act
      Logger.Instance.err(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });

    it('should log the stack of the error and of each cause', () => {
      // arrange
      const root = new Error('EACCES: permission denied');
      const cause = new Error('ENOENT: no such file', { cause: root });
      const error = new Error('Failed to read the file', { cause });

      // act
      Logger.Instance.err('Test message', error);

      // assert
      expect(logSpy).toHaveBeenCalledWith(
        chalk.red(
          `[cypress-har-generator] Test message\n${error.stack}\nCaused by:\n${cause.stack}\nCaused by:\n${root.stack}`
        )
      );
    });

    it('should log a cause that is not an error', () => {
      // arrange
      const error = new Error('Failed to connect', { cause: { code: 1 } });

      // act
      Logger.Instance.err('Test message', error);

      // assert
      expect(logSpy).toHaveBeenCalledWith(
        chalk.red(
          `[cypress-har-generator] Test message\n${error.stack}\nCaused by:\n{ code: 1 }`
        )
      );
    });

    it('should stop at a cause that is already in the chain', () => {
      // arrange
      const error = new Error('Failed to connect');
      error.cause = error;

      // act
      Logger.Instance.err('Test message', error);

      // assert
      expect(logSpy).toHaveBeenCalledWith(
        chalk.red(`[cypress-har-generator] Test message\n${error.stack}`)
      );
    });
  });

  describe('warn', () => {
    it('should log a magenta warning with the plugin name', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.magenta(
        `[cypress-har-generator] Warning: ${message}`
      );

      // act
      Logger.Instance.warn(message);

      // assert
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('debug', () => {
    // Node reads NODE_DEBUG once at startup, so each case runs in a new process
    const debugOutput = (nodeDebug: string): string =>
      spawnSync(
        process.execPath,
        [
          '--no-warnings',
          '--experimental-transform-types',
          '--input-type=module',
          '-e',
          `const { Logger } = await import(${JSON.stringify(resolve('src/utils/Logger.ts'))});
          Logger.Instance.debug('Test message', new Error('Failed', { cause: new Error('ENOENT') }));`
        ],
        { env: { ...process.env, NODE_DEBUG: nodeDebug }, encoding: 'utf8' }
      ).stderr;

    it('should log the message with the plugin name and the causes when NODE_DEBUG names the plugin', () => {
      // act
      const output = debugOutput('cypress-har-generator');

      // assert
      expect(output).toMatch(
        /^\[cypress-har-generator\] Test message\nError: Failed\n[\s\S]*\nCaused by:\nError: ENOENT\n/
      );
    });

    it('should log nothing when NODE_DEBUG does not name the plugin', () => {
      // act
      const output = debugOutput('http');

      // assert
      expect(output).toBe('');
    });
  });

  describe('deprecate', () => {
    it('should warn only the first time for the same id', () => {
      // arrange
      const message = 'Test message';
      const expectedLog = chalk.magenta(
        `[cypress-har-generator] Warning: ${message}`
      );

      // act
      Logger.Instance.deprecate('test-id', message);
      Logger.Instance.deprecate('test-id', message);

      // assert
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expectedLog);
    });
  });
});
