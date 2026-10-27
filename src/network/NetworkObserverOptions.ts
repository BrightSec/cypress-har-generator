export interface NetworkObserverOptions {
  content?: boolean;
  excludePaths?: (string | RegExp)[];
  includeHosts?: (string | RegExp)[];
  includeMimes?: string[];
  excludeStatusCodes?: number[];
  /**
   * Records requests to `blob:` URLs.
   * @defaultValue false
   */
  includeBlobs?: boolean;
}
