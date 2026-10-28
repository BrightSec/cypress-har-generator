import { HarTests } from './HarTests.ts';
import { describe, expect, it } from '@jest/globals';

describe('HarTests', () => {
  const start = (
    titlePath: string[],
    startedAt: number,
    { attempt = 1, spec = 'cypress/e2e/a.cy.ts' } = {}
  ): string => JSON.stringify({ spec, titlePath, attempt, startedAt });

  describe('idAt', () => {
    it('should return the ID of the test that started last by the given time', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'first'], 10));
      sut.start(start(['a', 'second'], 20));
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

    it('should forget the tests of the previous spec', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'test'], 10));
      sut.start(start(['b', 'test'], 30, { spec: 'cypress/e2e/b.cy.ts' }));
      // act
      const result = [sut.idAt(20), sut.idAt(30)];
      // assert
      expect(result).toEqual([undefined, 'test_1']);
    });

    it('should keep the order by start when a test is sent again later', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'second'], 20));
      sut.start(start(['a', 'first'], 10));
      // act
      const result = sut.idAt(15);
      // assert
      expect(result).toBe('test_1');
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
      expect(sut.idAt(Infinity)).toBeUndefined();
    });
  });

  describe('toArray', () => {
    it('should list each try of a test once, in start order', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'test'], 20, { attempt: 2 }));
      sut.start(start(['a', 'test'], 10));
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
      const sut = new HarTests();
      sut.start(start(['a', 'test'], 10));
      // act
      const result = sut.toArray({
        startedDateTime: '1970-01-01T00:00:00.000Z'
      });
      // assert
      expect(result[0].startedDateTime).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('select', () => {
    it('should keep only the tests running at the given times, numbered anew', () => {
      // arrange
      const sut = new HarTests();
      sut.start(start(['a', 'first'], 10));
      sut.start(start(['a', 'second'], 20));
      sut.start(start(['a', 'third'], 30));
      // act
      const result = sut.select([5, 35, 31]);
      // assert
      expect(result.toArray().map(x => [x.id, x.titlePath[1]])).toEqual([
        ['test_1', 'third']
      ]);
      expect([result.idAt(5), result.idAt(35)]).toEqual([undefined, 'test_1']);
    });
  });
});
