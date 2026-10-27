export interface NetworkObserverOptions {
  content?: boolean;
  excludePaths?: (string | RegExp)[];
  /**
   * Records only requests to these hosts. A host name, such as `'api.example.com'`, `'localhost:8080'` or `'[::1]'`,
   * matches only that host, ignoring case, and any port unless the name has one.
   * A regular expression, or any other string as its source, is tested against the host with its port.
   */
  includeHosts?: (string | RegExp)[];
  /**
   * Does not record requests to these hosts, even when {@link includeHosts} has them.
   * The patterns match as in {@link includeHosts}.
   */
  excludeHosts?: (string | RegExp)[];
  includeMimes?: string[];
  excludeStatusCodes?: number[];
  /**
   * @deprecated Will be removed in version 6. Use {@link excludeStatusCodes} instead.
   */
  minStatusCodeToInclude?: number;
  /**
   * Records requests to `blob:` URLs.
   * @defaultValue `true`; version 6 changes it to `false`, so set it explicitly to keep the current behaviour.
   */
  includeBlobs?: boolean;
}
