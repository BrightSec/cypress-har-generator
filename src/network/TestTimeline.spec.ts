import { TestTimeline } from './TestTimeline.ts';
import type { TestStart } from './TestStart.ts';
import { describe, expect, it } from '@jest/globals';

describe('TestTimeline', () => {
  const start = (
    titlePath: string[],
    startedAt: number,
    attempt = 1
  ): TestStart => ({
    spec: 'cypress/e2e/a.cy.ts',
    titlePath,
    attempt,
    startedAt
  });

  describe('idAt', () => {
    it('should return the ID of the test that started last by the given time', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'first'], 10),
        start(['a', 'second'], 20)
      ]);
      // act
      const result = [5, 10, 15, 20, 99].map(x => sut.idAt(x));
      // assert
      expect(result).toEqual([
        undefined,
        'test_1',
        'test_1',
        'test_2',
        'test_2'
      ]);
    });
  });

  it('should give an entry the test that started last when two started at the same time', () => {
    // arrange
    const sut = new TestTimeline([
      start(['a', 'first'], 10),
      start(['a', 'second'], 10)
    ]);
    // act
    const result = sut.idAt(10);
    // assert
    expect(result).toBe('test_2');
  });

  describe('toArray', () => {
    it('should list each try of a test once, in start order', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'test'], 10),
        start(['a', 'test'], 20, 2)
      ]);
      // act
      const result = sut.toArray();
      // assert
      expect(result).toEqual([
        {
          startedDateTime: new Date(10).toISOString(),
          id: 'test_1',
          titlePath: ['a', 'test'],
          attempt: 1
        },
        {
          startedDateTime: new Date(20).toISOString(),
          id: 'test_2',
          titlePath: ['a', 'test'],
          attempt: 2
        }
      ]);
    });

    it('should start each test at the given time', () => {
      // arrange
      const sut = new TestTimeline([start(['a', 'test'], 10)]);
      // act
      const result = sut.toArray({
        startedDateTime: '1970-01-01T00:00:00.000Z'
      });
      // assert
      expect(result[0].startedDateTime).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('withStates', () => {
    const stateOf = ({
      titlePath,
      attempt
    }: Pick<TestStart, 'titlePath' | 'attempt'>) =>
      titlePath[1] === 'flaky'
        ? attempt === 1
          ? 'failed'
          : 'passed'
        : undefined;

    it('should list each try with the state it ended in, leaving it out when unknown', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'flaky'], 10),
        start(['a', 'flaky'], 20, 2),
        start(['a', 'unknown'], 30)
      ]).withStates(stateOf);
      // act
      const result = sut.toArray();
      // assert
      expect(result.map(x => [x.id, x.state])).toEqual([
        ['test_1', 'failed'],
        ['test_2', 'passed'],
        ['test_3', undefined]
      ]);
      expect(result[2]).not.toHaveProperty('state');
    });

    it('should keep the states after only and select', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'flaky'], 10),
        start(['a', 'flaky'], 20, 2)
      ])
        .withStates(stateOf)
        .only(({ attempt }) => attempt === 1);
      // act
      const result = sut.select([15]).toArray();
      // assert
      expect(sut.keeps(25)).toBe(false);
      expect(result.map(x => [x.id, x.state])).toEqual([['test_1', 'failed']]);
    });
  });

  describe('select', () => {
    it('should keep only the tests running at the given times, numbered anew', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'first'], 10),
        start(['a', 'second'], 20),
        start(['a', 'third'], 30)
      ]);
      // act
      const result = sut.select([5, 35, 31]);
      // assert
      expect(result.toArray().map(x => [x.id, x.titlePath[1]])).toEqual([
        ['test_1', 'third']
      ]);
      expect([result.idAt(5), result.idAt(35)]).toEqual([undefined, 'test_1']);
    });
  });

  describe('keeps', () => {
    it('should keep the entries of every time when no filter is set', () => {
      // arrange
      const sut = new TestTimeline([start(['a', 'first'], 10)]);
      // act
      const result = [5, 15].map(x => sut.keeps(x));
      // assert
      expect(result).toEqual([true, true]);
    });

    it('should keep only the entries sent by the accepted tests, leaving out those sent before the first one', () => {
      // arrange
      const sut = new TestTimeline([
        start(['a', 'first'], 10),
        start(['a', 'second'], 20)
      ]).only(({ titlePath }) => titlePath[1] === 'second');
      // act
      const result = [5, 15, 25].map(x => sut.keeps(x));
      // assert
      expect(result).toEqual([false, false, true]);
    });
  });
});
