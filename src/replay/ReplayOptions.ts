/**
 * What `cy.replayHar()` does with a request the HAR has no entry for. See {@link ReplayOptions.notFound}.
 */
export type NotFoundAction = 'abort' | 'fallback';

/**
 * When `cy.replayHar()` without a path records the HAR of the spec instead of replaying it, set through the `hars_update` key of `expose`:
 * `'missing'` records it only when it does not exist yet, `'all'` records it again, and `'none'` never records it and fails without one.
 */
export type UpdateMode = 'missing' | 'all' | 'none';

/**
 * Which requests `cy.replayHar()` serves from the HAR, and what it does with those the HAR has no entry for.
 */
export interface ReplayOptions {
  /**
   * Serves from the HAR only the requests whose URL matches this glob pattern or regular expression,
   * as the `url` of `cy.intercept()`. Other requests reach the network as usual.
   * @defaultValue every request
   */
  url?: string | RegExp;
  /**
   * What to do with a request that has no matching entry in the HAR:
   * `'abort'` fails it with a network error, `'fallback'` passes it on to the other `cy.intercept()` handlers and the network.
   * @defaultValue 'abort'
   */
  notFound?: NotFoundAction;
}
