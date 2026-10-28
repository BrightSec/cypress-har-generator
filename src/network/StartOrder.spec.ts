import { StartOrder } from './StartOrder.ts';
import { describe, expect, it } from '@jest/globals';

describe('StartOrder', () => {
  const item = (name: string, startedAt: number) => ({ name, startedAt });

  describe('insert', () => {
    it('should keep the items in the order they started', () => {
      // arrange
      const sut = new StartOrder([item('b', 20), item('c', 30)]);
      // act
      sut.insert(item('a', 10));
      // assert
      expect(sut.items.map(x => x.name)).toEqual(['a', 'b', 'c']);
    });

    it('should add an item after the ones that started at the same time', () => {
      // arrange
      const sut = new StartOrder([item('first', 10)]);
      // act
      sut.insert(item('second', 10));
      // assert
      expect(sut.items.map(x => x.name)).toEqual(['first', 'second']);
    });
  });

  describe('indexAt', () => {
    it.each([
      { time: 5, expected: -1 },
      { time: 10, expected: 1 },
      { time: 15, expected: 1 },
      { time: 20, expected: 2 },
      { time: Infinity, expected: 2 }
    ])(
      'should return $expected as the last item started by $time',
      ({ time, expected }) => {
        // arrange
        const sut = new StartOrder([
          item('a', 10),
          item('b', 10),
          item('c', 20)
        ]);
        // act
        const result = sut.indexAt(time);
        // assert
        expect(result).toBe(expected);
      }
    );

    it('should return -1 when there are no items', () => {
      // act
      const result = new StartOrder().indexAt(10);
      // assert
      expect(result).toBe(-1);
    });
  });
});
