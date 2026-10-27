import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import type { FileHandle } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';

const actual = await import('node:fs/promises');

jest.unstable_mockModule('node:fs/promises', () => ({
  ...actual,
  open: jest.fn(actual.open),
  unlink: jest.fn(actual.unlink)
}));

const fsPromises = await import('node:fs/promises');
const { access } = fsPromises;
const { FileManager } = await import('./FileManager.ts');

describe('FileManager', () => {
  let path!: string;

  const data = 'test data';
  const sut = FileManager.Instance;

  beforeEach(() => {
    path = join(tmpdir(), randomBytes(16).toString('hex').substring(16));
  });

  afterEach(() => sut.removeFile(path));

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
      await expect(access(path, constants.F_OK)).rejects.toThrow();
    });

    it('should do nothing if the file does not exist', async () => {
      // act
      await sut.removeFile(path);
      // assert
      await expect(access(path, constants.F_OK)).rejects.toThrow();
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
      await expect(access(path, constants.F_OK)).resolves.not.toThrow();
    });

    it('should create missing parent folders', async () => {
      // arrange
      const nested = join(path, 'hars', 'deep');
      // act
      await sut.createFolder(nested);
      // assert
      try {
        await expect(access(nested, constants.F_OK)).resolves.not.toThrow();
      } finally {
        await actual.rm(path, { recursive: true, force: true });
      }
    });

    it('should do nothing if the folder already exists', async () => {
      // arrange
      await sut.createFolder(path);
      // act
      await sut.createFolder(path);
      // assert
      await expect(access(path, constants.F_OK)).resolves.not.toThrow();
    });
  });

  describe('createTmpFile', () => {
    it('should create a temp file that can be written and read', async () => {
      // arrange
      const file = await sut.createTmpFile();
      await file.write(data);
      // act
      const { buffer, bytesRead } = await file.read(
        Buffer.alloc(data.length),
        0,
        data.length,
        0
      );
      // assert
      expect(buffer.toString('utf-8', 0, bytesRead)).toBe(data);
      await file.close();
    });

    it('should leave no temp file on disk', async () => {
      // act
      const file = await sut.createTmpFile();
      // assert
      await expect(file.stat()).resolves.toMatchObject({ nlink: 0 });
      await file.close();
    });

    it('should close the temp file if it cannot be unlinked', async () => {
      // arrange
      const error = new Error('EPERM');
      jest.mocked(fsPromises.open).mockClear();
      jest.mocked(fsPromises.unlink).mockRejectedValueOnce(error);
      // act
      const act = sut.createTmpFile();
      // assert
      await expect(act).rejects.toThrow(error);
      const { calls, results } = jest.mocked(fsPromises.open).mock;
      path = calls[0][0] as string;
      const file: FileHandle = await (results[0].value as Promise<FileHandle>);
      expect(file.fd).toBe(-1);
    });
  });
});
