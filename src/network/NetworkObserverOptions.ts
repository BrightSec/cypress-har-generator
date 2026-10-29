/**
 * Which requests are recorded, and whether their response bodies are.
 */
export interface NetworkObserverOptions {
  /**
   * Records the response bodies in `content.text`. Turn it off to make the HAR smaller.
   * @defaultValue true
   */
  content?: boolean;
  /**
   * Does not record requests whose URL path matches one of these regular expressions, or strings as their sources.
   * Passing it replaces the default, which leaves out the requests Cypress makes on the origin of the app,
   * such as `/__/` and `/__cypress/`.
   * @defaultValue `[/^\/__(cypress[\w-]*)?\//]`
   */
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
  /**
   * Records only the requests whose response has one of these MIME types, such as `'application/json'`, compared as written.
   */
  includeMimes?: string[];
  /**
   * Does not record the requests whose response has one of these status codes.
   */
  excludeStatusCodes?: number[];
  /**
   * Records requests to `blob:` URLs.
   * @defaultValue false
   */
  includeBlobs?: boolean;
}
