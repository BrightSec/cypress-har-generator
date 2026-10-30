import { ErrorUtils } from './ErrorUtils.ts';
import chalk from 'chalk';
import { debuglog, inspect } from 'node:util';

export class Logger {
  private static _instance: Logger;
  private readonly _debug = debuglog('cypress-har-generator');
  private readonly deprecations = new Set<string>();
  private readonly prefix = '[cypress-har-generator]';

  // eslint-disable-next-line @typescript-eslint/naming-convention
  static get Instance(): Logger {
    if (!this._instance) {
      this._instance = new Logger();
    }

    return this._instance;
  }

  public info(msg: string): void {
    this.log(`${this.prefix} ${msg}`);
  }

  public err(msg: string, error?: unknown): void {
    this.log(chalk.red(`${this.prefix} ${this.withError(msg, error)}`));
  }

  // magenta with a `Warning:` lead, as Cypress prints its own warnings
  public warn(msg: string, error?: unknown): void {
    this.log(
      chalk.magenta(`${this.prefix} Warning: ${this.withError(msg, error)}`)
    );
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

  private withError(msg: string, error: unknown): string {
    return error === undefined ? msg : `${msg}\n${this.format(error)}`;
  }

  // prints each cause under `Caused by:`, as Cypress does, but the whole chain rather than 3 levels
  private format(error: unknown, seen = new Set<unknown>()): string {
    if (!ErrorUtils.isError(error)) {
      return inspect(error);
    }

    seen.add(error);

    const text = error.stack ?? `${error.name}: ${error.message}`;
    const { cause } = error;

    return cause === undefined || seen.has(cause)
      ? text
      : `${text}\nCaused by:\n${this.format(cause, seen)}`;
  }

  private log(msg: string): void {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
}
