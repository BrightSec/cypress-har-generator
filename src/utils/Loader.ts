import { ErrorUtils } from './ErrorUtils';
import { pathToFileURL } from 'node:url';

export class Loader {
  public static async load<T>(path: string): Promise<T | undefined> {
    let module: unknown;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      module = require(/* webpackIgnore: true */ path);
    } catch (err) {
      if (!this.shouldUseDynamicImport(err)) {
        throw err;
      }

      module = (
        await import(/* webpackIgnore: true */ pathToFileURL(path).href)
      ).default;
    }

    return this.interopRequireDefault<T | undefined>(module);
  }

  private static shouldUseDynamicImport(err: unknown): boolean {
    const stack = ErrorUtils.isError(err) ? err.stack : undefined;

    return !!(
      stack?.includes('[ERR_REQUIRE_ESM]') ||
      stack?.includes('[ERR_REQUIRE_ASYNC_MODULE]') ||
      stack?.includes(
        'SyntaxError: Cannot use import statement outside a module'
      )
    );
  }

  private static interopRequireDefault<T>(m: unknown): T | undefined {
    // @ts-expect-error unknown is not assignable to the module type
    return m && m.__esModule && m.default ? m.default : m;
  }
}
