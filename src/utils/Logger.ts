import chalk from 'chalk';
import { debuglog } from 'node:util';

export class Logger {
  private static _instance: Logger;
  private readonly _debug = debuglog('cypress-har-generator');
  private readonly deprecations = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/naming-convention
  static get Instance(): Logger {
    if (!this._instance) {
      this._instance = new Logger();
    }

    return this._instance;
  }

  public info(msg: string): void {
    this.log(chalk.blue(`ℹ️ ${msg}`));
  }

  public err(msg: string | Error | unknown): void {
    this.log(chalk.red(`🍑 ${msg}`));
  }

  public warn(msg: string): void {
    this.log(chalk.yellow(`⚠ ${msg}`));
  }

  // warns only the first time for a given id, so a deprecated call in every spec does not flood the output
  public deprecate(id: string, msg: string): void {
    if (this.deprecations.has(id)) {
      return;
    }

    this.deprecations.add(id);
    this.warn(msg);
  }

  public debug(msg: string): void {
    this._debug(msg);
  }

  private log(msg: string): void {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
}
