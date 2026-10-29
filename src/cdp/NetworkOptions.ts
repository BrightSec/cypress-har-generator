/**
 * The buffer limits Chrome applies to the bodies it keeps, passed to `Network.enable` of the Chrome DevTools Protocol.
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-enable
 */
export interface NetworkOptions {
  /**
   * The largest response body, in bytes, Chrome keeps. A larger body is left out of the entry,
   * and `content._error` tells why. It cannot exceed 256 MB, the limit of the DevTools WebSocket.
   * @defaultValue 10 MB, set by Chrome
   */
  maxResourceBufferSize?: number;
  /**
   * The bytes Chrome keeps for all the response bodies together.
   */
  maxTotalBufferSize?: number;
  /**
   * The longest request body, in bytes, Chrome sends with the request. A longer body is fetched afterwards, so it is still recorded.
   */
  maxPostDataSize?: number;
}
