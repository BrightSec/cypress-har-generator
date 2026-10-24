import { Logger } from './Logger';
import {
  access,
  writeFile,
  readFile,
  mkdir,
  unlink,
  open,
  readdir,
  stat,
  constants
} from 'node:fs/promises';
import { type WriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Serializable = unknown;

const TMP_FILE_PATTERN = /^(\d+)-[\da-f]+$/;
// A live recording keeps writing to its file, so a file left untouched this long is abandoned.
const STALE_TMP_FILE_AGE = 60 * 60 * 1000;

export class FileManager {
  private static _instance: FileManager;

  // Per user, so users sharing the temp folder do not lock each other out.
  private readonly tmpDir = join(
    tmpdir(),
    `cypress-har-generator${process.getuid ? `-${process.getuid()}` : ''}`
  );
  private sweep?: Promise<void>;

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
    await mkdir(this.tmpDir, { recursive: true, mode: 0o700 });
    await (this.sweep ??= this.removeStaleTmpFiles());

    const name = randomBytes(16).toString('hex').substring(16);
    const tmpPath = join(this.tmpDir, `${process.pid}-${name}`);
    const fileHandle = await open(tmpPath, 'wx+', 0o600);
    const stream = fileHandle.createWriteStream({
      encoding: 'utf-8'
    });

    stream.path = tmpPath;

    return stream;
  }

  // A killed process leaves its temp file behind. A file is swept only when its
  // process is gone AND it is stale, since a pid means nothing across containers.
  private async removeStaleTmpFiles(): Promise<void> {
    try {
      const names = await readdir(this.tmpDir);

      await Promise.all(
        names
          .filter(name => {
            const pid = TMP_FILE_PATTERN.exec(name)?.[1];

            return pid && !this.isProcessAlive(+pid);
          })
          .map(name => this.removeIfStale(join(this.tmpDir, name)))
      );
    } catch (e) {
      Logger.Instance.err(e);
    }
  }

  private async removeIfStale(path: string): Promise<void> {
    const { mtimeMs } = await stat(path).catch(() => ({ mtimeMs: Date.now() }));

    if (Date.now() - mtimeMs > STALE_TMP_FILE_AGE) {
      await this.removeFile(path);
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
