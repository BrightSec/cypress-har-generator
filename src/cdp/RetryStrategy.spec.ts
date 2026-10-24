import { RetryStrategy } from './RetryStrategy.ts';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

const findArg = <R>(
  args: [unknown, unknown],
  expected: 'function' | 'number'
): R => (typeof args[0] === expected ? args[0] : args[1]) as R;

const useFakeTimers = () => {
  jest.useFakeTimers();

  const mockedImplementation = jest
    .spyOn(global, 'setTimeout')
    .getMockImplementation();

  jest
    .spyOn(global, 'setTimeout')
    .mockImplementation((...args: [unknown, unknown]) => {
      // ADHOC: depending on implementation (promisify vs raw), the method signature will be different
      const callback = findArg<(..._: unknown[]) => void>(args, 'function');
      const ms = findArg<number>(args, 'number');
      const timer = mockedImplementation?.(callback, ms);

      jest.runAllTimers();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return timer!;
    });
};

describe('RetryStrategy', () => {
  let task!: jest.Mock;

  beforeEach(() => {
    task = jest.fn();
    useFakeTimers();
  });

  afterEach(() => {
    task.mockRestore();
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('should execute the task', async () => {
      // arrange
      const retryStrategy = new RetryStrategy(3, 10, 1000);
      // act
      await retryStrategy.execute(task);
      // assert
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should execute the task the specified number of times', async () => {
      // arrange
      const retryStrategy = new RetryStrategy(3, 10, 1000);
      // act
      for (let i = 0; i < 4; i++) {
        await retryStrategy.execute(task);
      }
      // assert
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('should delay execution between retries', async () => {
      // arrange
      const initialBackoff = 10;
      const maximumBackoff = 1000;
      const retryStrategy = new RetryStrategy(
        3,
        initialBackoff,
        maximumBackoff
      );

      // act
      await retryStrategy.execute(task);

      // assert
      expect(setTimeout).toHaveBeenCalledWith(
        expect.anything(),
        initialBackoff
      );
    });

    it('should return the number of retries remaining', async () => {
      // arrange
      const retryStrategy = new RetryStrategy(3, 10, 1000);
      // act
      const retriesRemaining = await retryStrategy.execute(task);
      // assert
      expect(retriesRemaining).toBe(2);
    });

    it('should do nothing when number of retries is reached', async () => {
      // arrange
      const retryStrategy = new RetryStrategy(0, 10, 1000);
      // act
      await retryStrategy.execute(task);
      // assert
      expect(task).not.toHaveBeenCalled();
    });
  });
});
