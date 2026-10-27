export interface NetworkObserverOptions {
  content?: boolean;
  excludePaths?: (string | RegExp)[];
  includeHosts?: (string | RegExp)[];
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
