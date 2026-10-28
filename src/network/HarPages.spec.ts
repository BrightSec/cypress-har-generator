import { type HarDocument, HarPages } from './HarPages.ts';
import { describe, expect, it } from '@jest/globals';

describe('HarPages', () => {
  const document = (
    loaderId: string,
    frameId: string,
    startedAt: number,
    ancestors: string[] = ['runner']
  ): HarDocument => ({
    loaderId,
    frameId,
    ancestors,
    startedAt,
    url: `https://example.com/${loaderId}`
  });

  describe('toArray', () => {
    it('should return a page for each document of the topmost recorded frame, in the order they started', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('second', 'aut', 20));
      sut.add(document('first', 'aut', 10));
      // act
      const result = sut.toArray();
      // assert
      expect(result).toEqual([
        {
          startedDateTime: new Date(10).toISOString(),
          id: 'page_1',
          title: 'https://example.com/first',
          pageTimings: {}
        },
        {
          startedDateTime: new Date(20).toISOString(),
          id: 'page_2',
          title: 'https://example.com/second',
          pageTimings: {}
        }
      ]);
    });

    it('should not return a page for the document of an iframe', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('page', 'aut', 10));
      sut.add(document('iframe', 'child', 15, ['aut', 'runner']));
      // act
      const result = sut.toArray();
      // assert
      expect(result.map(x => x.title)).toEqual(['https://example.com/page']);
    });

    it('should return a page for each tab', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('page', 'aut', 10));
      sut.add(document('popup', 'popup', 15, []));
      // act
      const result = sut.toArray();
      // assert
      expect(result.map(x => x.id)).toEqual(['page_1', 'page_2']);
    });

    it('should title a redirected page with its last URL and start it with its first hop', () => {
      // arrange
      const sut = new HarPages();
      sut.add({ ...document('page', 'aut', 15), url: 'https://example.com/b' });
      sut.add({ ...document('page', 'aut', 10), url: 'https://example.com/a' });
      // act
      const result = sut.toArray();
      // assert
      expect(result).toEqual([
        expect.objectContaining({
          startedDateTime: new Date(10).toISOString(),
          title: 'https://example.com/b'
        })
      ]);
    });

    it('should use the given start time', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('page', 'aut', 10));
      // act
      const result = sut.toArray({
        startedDateTime: '1970-01-01T00:00:00.000Z'
      });
      // assert
      expect(result[0].startedDateTime).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('idOf', () => {
    it('should return the page of an iframe document from the page loaded above it when it started', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('first', 'aut', 10));
      sut.add(document('second', 'aut', 20));
      sut.add(document('iframe', 'child', 25, ['aut', 'runner']));
      sut.add(document('nested', 'grandchild', 26, ['child', 'aut', 'runner']));
      // act
      const result = ['first', 'second', 'iframe', 'nested'].map(x =>
        sut.idOf(x)
      );
      // assert
      expect(result).toEqual(['page_1', 'page_2', 'page_2', 'page_2']);
    });

    it('should return nothing for a loader with no recorded document', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('page', 'aut', 10));
      // act
      const result = sut.idOf('runner-loader');
      // assert
      expect(result).toBeUndefined();
    });

    it('should renumber the pages when an earlier page is added after reading', () => {
      // arrange
      const sut = new HarPages();
      sut.add(document('second', 'aut', 20));
      sut.idOf('second');
      // act
      sut.add(document('first', 'aut', 10));
      // assert
      expect(sut.idOf('second')).toBe('page_2');
    });
  });
});
