import { FileManager } from './FileManager';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants, WriteStream } from 'node:fs';
import { access, utimes } from 'node:fs/promises';

describe('FileManager', () => {
  let path!: string;

  const data = 'test data';
  const staleTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const pid = 4242;
  const sut = FileManager.Instance;

  const stubProcess = (alive: boolean) =>
    jest.spyOn(process, 'kill').mockImplementation(() => {
      if (!alive) {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
      }

      return true;
    });

  beforeEach(() => {
    path = join(tmpdir(), randomBytes(16).toString('hex').substring(16));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await sut.removeFile(path);
  });

  describe('readFile', () => {
    it('should return the contents of a file', async () => {
      // arrange
      await sut.writeFile(path, data);
      // act
      const result = await sut.readFile(path);
      // assert
      expect(result).toEqual(data);
    });

    it('should return undefined if the file does not exist', async () => {
      // act
      const result = await sut.readFile(path);

      // assert
      expect(result).toBeUndefined();
    });
  });

  describe('writeFile', () => {
    it('should write data to a file', async () => {
      // act
      await sut.writeFile(path, data);
      // assert
      const result = await sut.readFile(path);
      expect(result).toEqual(data);
    });

    it('should rewrite data in a file if exists', async () => {
      // arrange
      const prevData = 'test';
      await sut.writeFile(path, prevData);
      // act
      await sut.writeFile(path, data);
      // assert
      const result = await sut.readFile(path);
      expect(result).toEqual(data);
    });
  });

  describe('removeFile', () => {
    it('should remove the file if it exists', async () => {
      // arrange
      await sut.writeFile(path, data);
      // act
      await sut.removeFile(path);
      // assert
      await expect(access(path, constants.F_OK)).rejects.toThrowError();
    });

    it('should do nothing if the file does not exist', async () => {
      // act
      await sut.removeFile(path);
      // assert
      await expect(access(path, constants.F_OK)).rejects.toThrowError();
    });
  });

  describe('pathExists', () => {
    it('should return true if the file exists', async () => {
      // arrange
      await sut.writeFile(path, data);
      // act
      const result = await sut.pathExists(path);
      // assert
      expect(result).toBeTruthy();
    });

    it('should return false if the file does not exist', async () => {
      // act
      const result = await sut.pathExists(path);
      // assert
      expect(result).toBeFalsy();
    });
  });

  describe('createFolder', () => {
    it('should create the folder if it does not exist', async () => {
      // act
      await sut.createFolder(path);
      // assert
      await expect(access(path, constants.F_OK)).resolves.not.toThrowError();
    });

    it('should do nothing if the folder already exists', async () => {
      // arrange
      await sut.createFolder(path);
      // act
      await sut.createFolder(path);
      // assert
      await expect(access(path, constants.F_OK)).resolves.not.toThrowError();
    });
  });

  describe('createTmpWriteStream', () => {
    it('should create a new write stream', async () => {
      // act
      const stream = await sut.createTmpWriteStream();
      // assert
      expect(stream).toBeInstanceOf(WriteStream);
    });

    it('should create a new temp file', async () => {
      // act
      const stream = await sut.createTmpWriteStream();
      // assert
      await expect(
        access(stream.path, constants.F_OK)
      ).resolves.not.toThrowError();
    });

    it('should create the temp file in its own folder', async () => {
      // act
      const stream = await sut.createTmpWriteStream();
      // assert
      expect(basename(dirname(stream.path as string))).toMatch(
        /^cypress-har-generator/
      );
    });

    it('should remove a stale temp file of a terminated process', async () => {
      // arrange
      const stream = await sut.createTmpWriteStream();
      path = join(dirname(stream.path as string), `${pid}-0123456789abcdef`);
      await sut.writeFile(path, data);
      await utimes(path, staleTime, staleTime);
      stubProcess(false);
      // act
      await new FileManager().createTmpWriteStream();
      // assert
      await expect(access(path, constants.F_OK)).rejects.toThrow();
    });

    it('should keep a fresh temp file of a terminated process', async () => {
      // arrange
      const stream = await sut.createTmpWriteStream();
      path = join(dirname(stream.path as string), `${pid}-0123456789abcdef`);
      await sut.writeFile(path, data);
      stubProcess(false);
      // act
      await new FileManager().createTmpWriteStream();
      // assert
      await expect(access(path, constants.F_OK)).resolves.not.toThrowError();
    });

    it('should keep a stale temp file of a running process', async () => {
      // arrange
      const stream = await sut.createTmpWriteStream();
      path = join(dirname(stream.path as string), `${pid}-0123456789abcdef`);
      await sut.writeFile(path, data);
      await utimes(path, staleTime, staleTime);
      stubProcess(true);
      // act
      await new FileManager().createTmpWriteStream();
      // assert
      await expect(access(path, constants.F_OK)).resolves.not.toThrowError();
    });
  });
});
