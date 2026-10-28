import { CoalescedChunks } from './CoalescedChunks.ts';
import { describe, expect, it } from '@jest/globals';

describe('CoalescedChunks', () => {
  async function* chunksOf(...chunks: string[]): AsyncGenerator<string> {
    yield* chunks;
  }

  const read = async (chunks: AsyncIterable<string>): Promise<string[]> => {
    const result: string[] = [];

    for await (const chunk of chunks) {
      result.push(chunk);
    }

    return result;
  };

  it('should join the small chunks up to the given size', async () => {
    // act
    const result = await read(
      new CoalescedChunks(chunksOf('ab', 'cd', 'ef', 'g'), 4)
    );
    // assert
    expect(result).toEqual(['abcd', 'efg']);
  });

  it('should pass a large chunk on alone, after the chunks before it', async () => {
    // arrange
    const large = 'x'.repeat(8);
    // act
    const result = await read(
      new CoalescedChunks(chunksOf('a', large, 'b'), 4)
    );
    // assert
    expect(result).toEqual(['a', large, 'b']);
    expect(result[1]).toBe(large);
  });

  it('should yield nothing for no chunks', async () => {
    // act
    const result = await read(new CoalescedChunks(chunksOf(), 4));
    // assert
    expect(result).toEqual([]);
  });
});
