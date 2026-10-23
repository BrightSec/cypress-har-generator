import { Logger } from './Logger';
import {
  access,
  writeFile,
  readFile,
  mkdir,
  unlink,
  open,
  constants
} from 'node:fs/promises';
import { type WriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Serializable = unknown;

export class FileManager {
  private static _instance: FileManager;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  static get Instance(): FileManager {
    if (!this._instance) {
      this._instance = new FileManager();
    }

    return this._instance;
  }

  public async readFile(path: string): Promise<string | undefined> {
    try {
      return await readFile(path, { encoding: 'utf-8' });
    } catch (e) {
      Logger.Instance.err(e);

      return undefined;
    }
  }

  public async writeFile<T extends Serializable>(
    path: string,
    content: T
  ): Promise<void> {
    const data =
      typeof content === 'string' ? content : JSON.stringify(content);

    await writeFile(path, data);
  }

  public async createFolder(path: string): Promise<void> {
    try {
      if (await this.pathExists(path)) {
        return;
      }

      await mkdir(path);
    } catch (e) {
      Logger.Instance.err(e);
    }
  }

  public async removeFile(path: string): Promise<void> {
    try {
      if (await this.pathExists(path)) {
        await unlink(path);
      }
    } catch (e) {
      Logger.Instance.err(e);
    }
  }

  public async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);

      return true;
    } catch {
      return false;
    }
  }

  public async createTmpWriteStream(): Promise<WriteStream> {
    const name = randomBytes(16).toString('hex').substring(16);
    const tmpPath = join(tmpdir(), name);
    const fileHandle = await open(tmpPath, 'wx+', 0o600);
    const stream = fileHandle.createWriteStream({
      encoding: 'utf-8'
    });

    stream.path = tmpPath;

    return stream;
  }
}
