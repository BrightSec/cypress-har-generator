export interface BrowserConfigSource {
  expose?(key: string): unknown;
  env?(key: string): unknown;
  config(key: string): unknown;
}

export interface NodeConfigSource {
  expose?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

export class ConfigUtils {
  // `Cypress.env()` is deprecated since Cypress 15.10, throws when `allowCypressEnv` is false and is removed in
  // Cypress 16, so a value is read from `Cypress.expose()` first and from `Cypress.env()` only where it still works.
  // Keys are tried in the given order, so a current name can be listed before the names it replaced.
  public static fromBrowser<T>(
    source: BrowserConfigSource,
    keys: string[]
  ): T | undefined {
    const exposed = this.find(keys, key => source.expose?.(key));

    if (exposed !== undefined) {
      return exposed as T;
    }

    if (
      typeof source.env !== 'function' ||
      source.config('allowCypressEnv') === false
    ) {
      return undefined;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.find(keys, key => source.env!(key)) as T | undefined;
    } catch {
      // Cypress 16 keeps `Cypress.env()` only to throw a removal error.
      return undefined;
    }
  }

  public static fromNode<T>(
    source: NodeConfigSource,
    keys: string[]
  ): T | undefined {
    return (this.find(keys, key => source.expose?.[key]) ??
      this.find(keys, key => source.env?.[key])) as T | undefined;
  }

  private static find(keys: string[], read: (key: string) => unknown): unknown {
    for (const key of keys) {
      const value = read(key);

      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }
}
