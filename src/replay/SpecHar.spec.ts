import { SpecHar } from './SpecHar.ts';
import type { HarTest } from '../network/TestTimeline.ts';
import type { Entry } from 'har-format';
import { describe, expect, it } from '@jest/globals';

describe('SpecHar', () => {
  const url = 'https://example.com/api';

  const entry = (status: number, testref?: string): Entry =>
    ({
      _testref: testref,
      request: { method: 'GET', url },
      response: { status, headers: [], content: { size: 0, mimeType: '' } }
    }) as unknown as Entry;

  const test = (id: string, titlePath: string[], attempt = 1): HarTest => ({
    startedDateTime: '2022-04-18T09:09:35.000Z',
    id,
    titlePath,
    attempt
  });

  const statusOf = (har: SpecHar, titlePath: string[]): number | undefined =>
    har.routerFor(titlePath).find({ method: 'GET', url })?.response.status;

  it('should serve a test only the entries it sent', () => {
    // arrange
    const sut = new SpecHar({
      entries: [entry(201, 'test_1'), entry(202, 'test_2')],
      tests: [test('test_1', ['a', 'first']), test('test_2', ['a', 'second'])]
    });

    // act
    const result = [
      statusOf(sut, ['a', 'second']),
      statusOf(sut, ['a', 'first'])
    ];

    // assert
    expect(result).toEqual([202, 201]);
  });

  it('should serve a test the entries of its last try', () => {
    // arrange
    const sut = new SpecHar({
      entries: [entry(500, 'test_1'), entry(200, 'test_2')],
      tests: [test('test_1', ['a'], 1), test('test_2', ['a'], 2)]
    });

    // act
    const result = statusOf(sut, ['a']);

    // assert
    expect(result).toBe(200);
  });

  it('should serve a test from its first entry on each try', () => {
    // arrange
    const sut = new SpecHar({
      entries: [entry(201, 'test_1'), entry(202, 'test_1')],
      tests: [test('test_1', ['a'])]
    });

    // act
    const result = [statusOf(sut, ['a']), statusOf(sut, ['a'])];

    // assert
    expect(result).toEqual([201, 201]);
  });

  it('should go on from where the previous test stopped for the tests the HAR does not name', () => {
    // arrange
    const sut = new SpecHar({
      entries: [entry(201), entry(202)],
      tests: []
    });

    // act
    const result = [statusOf(sut, ['a']), statusOf(sut, ['b'])];

    // assert
    expect(result).toEqual([201, 202]);
  });
});
