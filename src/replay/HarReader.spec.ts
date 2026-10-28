import { HarReader } from './HarReader.ts';
import type { FileManager } from '../utils/FileManager.ts';
import { instance, mock, reset, when } from 'ts-mockito';
import { afterEach, describe, expect, it } from '@jest/globals';

describe('HarReader', () => {
  const fileManagerMock = mock<FileManager>();
  const reader = new HarReader(instance(fileManagerMock));

  afterEach(() => reset(fileManagerMock));

  it('should return the entries of the HAR file', async () => {
    // arrange
    const entries = [{ request: { url: 'https://example.com/' } }];
    when(fileManagerMock.readFile('/project/example.har')).thenResolve(
      JSON.stringify({ log: { entries } })
    );

    // act
    const result = await reader.read('/project/example.har');

    // assert
    expect(result).toEqual(entries);
  });

  it('should throw when the file cannot be read', async () => {
    // arrange
    when(fileManagerMock.readFile('/project/missing.har')).thenResolve(
      undefined
    );

    // act & assert
    await expect(reader.read('/project/missing.har')).rejects.toThrow(
      'Failed to read the HAR file at /project/missing.har.'
    );
  });

  it('should throw a TypeError when the file is not a JSON', async () => {
    // arrange
    when(fileManagerMock.readFile('/project/example.har')).thenResolve('{');

    // act & assert
    await expect(reader.read('/project/example.har')).rejects.toThrow(
      TypeError
    );
  });

  it('should keep the parsing error as the cause', async () => {
    // arrange
    when(fileManagerMock.readFile('/project/example.har')).thenResolve('{');

    // act & assert
    await expect(reader.read('/project/example.har')).rejects.toMatchObject({
      cause: expect.any(SyntaxError)
    });
  });

  it.each(['null', '{}', '{"log":{}}', '{"log":{"entries":{}}}'])(
    'should throw a TypeError when the file is %s',
    async content => {
      // arrange
      when(fileManagerMock.readFile('/project/example.har')).thenResolve(
        content
      );

      // act & assert
      await expect(reader.read('/project/example.har')).rejects.toThrow(
        new TypeError(
          'The file at /project/example.har is not a HAR file: it has no `log.entries` array.'
        )
      );
    }
  );
});
