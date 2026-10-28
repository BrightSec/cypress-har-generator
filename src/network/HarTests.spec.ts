import { HarTests } from './HarTests.ts';
import { describe, expect, it } from '@jest/globals';

describe('HarTests', () => {
  const start = (
    titlePath: string[],
    startedAt: number,
    { attempt = 1, spec = 'cypress/e2e/a.cy.ts' } = {}
  ): string => JSON.stringify({ spec, titlePath, attempt, startedAt });

  describe('at', () => {
    it('should return the test that started last by the given time', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'first'], 10));
      sut.start(start(['a', 'second'], 20));
      // act
      const result = [5, 10, 15, 20, 99].map(x => sut.at(x)?.titlePath[1]);
      // assert
      expect(result).toEqual([undefined, 'first', 'first', 'second', 'second']);
    });

    it('should return the attempt of a retried test', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'test'], 10));
      sut.start(start(['a', 'test'], 20, { attempt: 2 }));
      // act
      const result = [sut.at(15), sut.at(25)];
      // assert
      expect(result).toEqual([
        { titlePath: ['a', 'test'], attempt: 1 },
        { titlePath: ['a', 'test'], attempt: 2 }
      ]);
    });

    it('should forget the tests of the previous spec', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'test'], 10));
      sut.start(start(['b', 'test'], 30, { spec: 'cypress/e2e/b.cy.ts' }));
      // act
      const result = sut.at(20);
      // assert
      expect(result).toBeUndefined();
    });

    it('should keep the order by start when a test is sent again later', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'second'], 20));
      sut.start(start(['a', 'first'], 10));
      // act
      const result = sut.at(15);
      // assert
      expect(result?.titlePath).toEqual(['a', 'first']);
    });

    it.each([
      'not a JSON',
      'null',
      JSON.stringify({ titlePath: ['a'], attempt: 1, startedAt: 1 }),
      JSON.stringify({ spec: 'a', titlePath: 'a', attempt: 1, startedAt: 1 }),
      JSON.stringify({ spec: 'a', titlePath: [1], attempt: 1, startedAt: 1 }),
      JSON.stringify({ spec: 'a', titlePath: ['a'], attempt: 0, startedAt: 1 }),
      JSON.stringify({
        spec: 'a',
        titlePath: ['a'],
        attempt: 1,
        startedAt: 'x'
      })
    ])('should ignore the payload %s', payload => {
      // arrange
      const sut = new HarTests();
      // act
      sut.start(payload);
      // assert
      expect(sut.at(Infinity)).toBeUndefined();
    });
  });
});
