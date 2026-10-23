import { Logger } from './Logger';
import {
  access,
  writeFile,
  readFile,
  mkdir,
  unlink,
  open,
  readdir,
  constants
} from 'node:fs/promises';
import { type WriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Serializable = unknown;

const TMP_FILE_PREFIX = 'cypress-har-';
const TMP_FILE_PATTERN = new RegExp(`^${TMP_FILE_PREFIX}(\\d+)-[\\da-f]+$`);

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
    await this.removeStaleTmpFiles();

    const name = randomBytes(16).toString('hex').substring(16);
    const tmpPath = join(tmpdir(), `${TMP_FILE_PREFIX}${process.pid}-${name}`);
    const fileHandle = await open(tmpPath, 'wx+', 0o600);
    const stream = fileHandle.createWriteStream({
      encoding: 'utf-8'
    });

    stream.path = tmpPath;

    return stream;
  }

  // Temp files outlive a process that is killed before it disposes of them,
  // so they are swept once their owning process is gone.
  private async removeStaleTmpFiles(): Promise<void> {
    try {
      const names = await readdir(tmpdir());

      await Promise.all(
        names
          .map(name => ({ name, pid: TMP_FILE_PATTERN.exec(name)?.[1] }))
          .filter(({ pid }) => pid && !this.isProcessAlive(+pid))
          .map(({ name }) => this.removeFile(join(tmpdir(), name)))
      );
    } catch (e) {
      Logger.Instance.err(e);
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);

      return true;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === 'EPERM';
    }
  }
}
