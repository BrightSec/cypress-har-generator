import { NetworkRequest } from './NetworkRequest.ts';
import { NetworkIdleMonitor } from './NetworkIdleMonitor.ts';
import type { Observer } from './Observer.ts';
import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect
} from '@jest/globals';
import { instance, mock, reset, when } from 'ts-mockito';

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

describe('NetworkIdleMonitor', () => {
  const observer = mock<Observer<NetworkRequest>>();
  let sut!: NetworkIdleMonitor;

  beforeEach(() => {
    useFakeTimers();
    sut = new NetworkIdleMonitor(instance(observer));
  });

  afterEach(() => {
    jest.useRealTimers();
    reset(observer);
  });

  describe('waitForIdle', () => {
    it('should return immediately when network is already idle', async () => {
      // arrange
      when(observer.empty).thenReturn(true);
      // act
      await sut.waitForIdle(1000);
      // assert
      expect(setTimeout).toHaveBeenCalledTimes(1);
    });

    it('should wait for the specified idle time when network is not idle', async () => {
      // arrange
      when(observer.empty).thenReturn(false, true);
      // act
      await sut.waitForIdle(1000);
      // assert
      expect(setTimeout).toHaveBeenCalledTimes(2);
    });
  });
});
