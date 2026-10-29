import chalk from 'chalk';
import { debuglog, inspect } from 'node:util';

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

  public err(msg: string, error?: unknown): void {
    this.log(chalk.red(`🍑 ${this.withError(msg, error)}`));
  }

  public warn(msg: string, error?: unknown): void {
    this.log(chalk.yellow(`⚠ ${this.withError(msg, error)}`));
  }

  // warns only the first time for a given id, so a deprecated call in every spec does not flood the output
  public deprecate(id: string, msg: string): void {
    if (this.deprecations.has(id)) {
      return;
    }

    this.deprecations.add(id);
    this.warn(msg);
  }

  public debug(msg: string, error?: unknown): void {
    this._debug(this.withError(msg, error));
  }

  // `inspect` prints the stack and every `cause` in the chain
  private withError(msg: string, error: unknown): string {
    return error === undefined ? msg : `${msg}\n${inspect(error)}`;
  }

  private log(msg: string): void {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
}
