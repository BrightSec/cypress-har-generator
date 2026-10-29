import { TestResults } from './TestResults.ts';
import { describe, expect, it } from '@jest/globals';

describe('TestResults', () => {
  const result = (
    title: string[],
    ...states: string[]
  ): CypressCommandLine.TestResult => ({
    title,
    state: states.at(-1) ?? 'pending',
    duration: 0,
    displayError: null,
    attempts: states.map(state => ({ state }))
  });

  it('should include each failed try of a test, counting from 1', () => {
    // arrange
    const sut = new TestResults([
      result(['suite', 'flaky'], 'failed', 'passed'),
      result(['suite', 'broken'], 'failed', 'failed')
    ]);
    // act
    const included = [
      { titlePath: ['suite', 'flaky'], attempt: 1 },
      { titlePath: ['suite', 'flaky'], attempt: 2 },
      { titlePath: ['suite', 'broken'], attempt: 1 },
      { titlePath: ['suite', 'broken'], attempt: 2 }
    ].map(sut.failed);
    // assert
    expect(included).toEqual([true, false, true, true]);
  });

  it('should not include a test that passed, was skipped or is unknown', () => {
    // arrange
    const sut = new TestResults([
      result(['suite', 'passed'], 'passed'),
      result(['suite', 'skipped'])
    ]);
    // act
    const included = [
      { titlePath: ['suite', 'passed'], attempt: 1 },
      { titlePath: ['suite', 'skipped'], attempt: 1 },
      { titlePath: ['suite', 'unknown'], attempt: 1 }
    ].map(sut.failed);
    // assert
    expect(included).toEqual([false, false, false]);
  });

  it('should tell apart titles that would join into the same text', () => {
    // arrange
    const sut = new TestResults([result(['a b', 'c'], 'failed')]);
    // act
    const included = sut.failed({ titlePath: ['a', 'b c'], attempt: 1 });
    // assert
    expect(included).toBe(false);
  });

  it('should give the state of each try, and none for an unknown test', () => {
    // arrange
    const sut = new TestResults([
      result(['suite', 'flaky'], 'failed', 'passed')
    ]);
    // act
    const states = [
      { titlePath: ['suite', 'flaky'], attempt: 1 },
      { titlePath: ['suite', 'flaky'], attempt: 2 },
      { titlePath: ['suite', 'flaky'], attempt: 3 },
      { titlePath: ['suite', 'unknown'], attempt: 1 }
    ].map(sut.stateOf);
    // assert
    expect(states).toEqual(['failed', 'passed', undefined, undefined]);
  });
});
