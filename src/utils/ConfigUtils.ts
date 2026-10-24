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
  public static fromBrowser<T>(
    source: BrowserConfigSource,
    key: string
  ): T | undefined {
    const exposed = source.expose?.(key);

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
      return source.env(key) as T | undefined;
    } catch {
      // Cypress 16 keeps `Cypress.env()` only to throw a removal error.
      return undefined;
    }
  }

  public static fromNode<T>(
    source: NodeConfigSource,
    key: string
  ): T | undefined {
    return (source.expose?.[key] ?? source.env?.[key]) as T | undefined;
  }
}
