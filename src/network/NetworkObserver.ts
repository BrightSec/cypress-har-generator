import { Logger } from '../utils/Logger';
import { NetworkRequest } from './NetworkRequest';
import { ExtraInfoBuilder } from './ExtraInfoBuilder';
import { CookieAttribute, NetworkCookie } from './NetworkCookie';
import type { NetworkObserverOptions } from './NetworkObserverOptions';
import type { Observer } from './Observer';
import type { RequestFilter } from './filters';
import type { Network, NetworkEvent } from './Network';
import type Protocol from 'devtools-protocol';
import type { Header } from 'har-format';

export class NetworkObserver implements Observer<NetworkRequest> {
  private readonly _entries: Map<Protocol.Network.RequestId, NetworkRequest>;
  private readonly _extraInfoBuilders: Map<
    Protocol.Network.RequestId,
    ExtraInfoBuilder
  >;
  private destination?: (chromeEntry: NetworkRequest) => unknown;

  get empty(): boolean {
    return this._entries.size === 0;
  }

  constructor(
    private readonly options: NetworkObserverOptions,
    private readonly network: Network,
    private readonly logger: Logger,
    private readonly requestFilter?: RequestFilter
  ) {
    this._entries = new Map<Protocol.Network.RequestId, NetworkRequest>();
    this._extraInfoBuilders = new Map<
      Protocol.Network.RequestId,
      ExtraInfoBuilder
    >();
  }

  public async subscribe(
    callback: (chromeEntry: NetworkRequest) => unknown
  ): Promise<void> {
    this.destination = callback;

    await this.network.attachToTargets((event: NetworkEvent): void =>
      this.handleEvent(event)
    );
  }

  public async unsubscribe(): Promise<void> {
    await this.network.detachFromTargets();
    delete this.destination;
    this._entries.clear();
    this._extraInfoBuilders.clear();
  }

  public signedExchangeReceived(
    params: Protocol.Network.SignedExchangeReceivedEvent
  ): void {
    const entry: NetworkRequest | undefined = this._entries.get(
      params.requestId
    );
    if (!entry) {
      return;
    }

    entry.signedExchangeInfo = params.info;
    entry.resourceType = 'SignedExchange';

    this.updateNetworkRequestWithResponse(entry, params.info.outerResponse);
  }

  public requestWillBeSent({
    type,
    loaderId,
    initiator,
    redirectResponse,
    documentURL,
    frameId,
    timestamp,
    requestId,
    request,
    wallTime
  }: Protocol.Network.RequestWillBeSentEvent): void {
    let entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (entry) {
      if (!redirectResponse) {
        return;
      }

      if (!entry.signedExchangeInfo) {
        this.responseReceived({
          requestId,
          loaderId,
          timestamp,
          frameId,
          type: 'Other',
          response: redirectResponse
        });
      }
      entry = this._appendRedirect(requestId, timestamp, request.url);
    } else {
      entry = this.createRequest(
        requestId,
        frameId,
        loaderId,
        request.url,
        documentURL,
        initiator
      );

      // The hop that was redirected was sent before recording began, so its
      // extra info must not be attached to this request.
      if (redirectResponse) {
        this.getExtraInfoBuilder(requestId).addUnseenRequest();
      }
    }

    this.updateNetworkRequestWithRequest(entry, request);

    entry.setIssueTime(timestamp, wallTime);
    entry.resourceType = type ?? 'Other';

    this.getExtraInfoBuilder(requestId).addRequest(entry);

    this.startRequest(entry);
  }

  public dataReceived({
    requestId,
    dataLength,
    encodedDataLength,
    timestamp
  }: Protocol.Network.DataReceivedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);
    if (!entry) {
      return;
    }
    entry.resourceSize += dataLength;
    if (encodedDataLength !== -1) {
      entry.increaseTransferSize(encodedDataLength);
    }
    entry.endTime = timestamp;
  }

  public responseReceived({
    requestId,
    response,
    timestamp,
    type
  }: Omit<Protocol.Network.ResponseReceivedEvent, 'hasExtraInfo'>): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.responseReceivedTime = timestamp;
    entry.resourceType = type;

    this.updateNetworkRequestWithResponse(entry, response);
  }

  public resourceChangedPriority({
    requestId,
    newPriority
  }: Protocol.Network.ResourceChangedPriorityEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.priority = newPriority;
  }

  public async loadingFinished({
    requestId,
    timestamp,
    encodedDataLength
  }: Protocol.Network.LoadingFinishedEvent): Promise<void> {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    this.finishRequest(entry, timestamp, encodedDataLength);
  }

  public loadingFailed({
    requestId,
    errorText,
    canceled,
    type,
    timestamp
  }: Protocol.Network.LoadingFailedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);
    if (!entry) {
      return;
    }

    entry.resourceType = type;

    this.finishRequest(entry, timestamp, -1);

    const message = errorText || (canceled && 'Canceled');
    this.logger.debug(`Failed request: ${requestId}. Reason: ${message}`);
  }

  public webSocketCreated({
    initiator,
    requestId,
    url
  }: Protocol.Network.WebSocketCreatedEvent): void {
    const entry: NetworkRequest = this.createRequest(
      requestId,
      '',
      '',
      url,
      '',
      initiator
    );
    this.startRequest(entry);
  }

  public eventSourceMessageReceived({
    requestId,
    timestamp,
    eventName,
    eventId,
    data
  }: Protocol.Network.EventSourceMessageReceivedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);
    if (!entry) {
      return;
    }
    entry.addEventSourceMessage(timestamp, eventName, eventId, data);
  }

  public webSocketWillSendHandshakeRequest({
    request,
    requestId,
    timestamp,
    wallTime
  }: Protocol.Network.WebSocketWillSendHandshakeRequestEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);
    if (!entry) {
      return;
    }
    entry.requestMethod = 'GET';
    entry.requestHeaders = this.headersMapToHeadersArray(request.headers);
    entry.setIssueTime(timestamp, wallTime);
  }

  public webSocketHandshakeResponseReceived({
    timestamp,
    response,
    requestId
  }: Protocol.Network.WebSocketHandshakeResponseReceivedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.statusCode = response.status;
    entry.statusText = response.statusText;
    entry.responseHeaders = this.headersMapToHeadersArray(response.headers);
    entry.responseHeadersText = response.headersText || '';

    if (response.requestHeaders) {
      entry.requestHeaders = this.headersMapToHeadersArray(
        response.requestHeaders
      );
    }

    if (response.requestHeadersText) {
      entry.requestHeadersText = response.requestHeadersText;
    }

    entry.responseReceivedTime = timestamp;
    entry.protocol = 'websocket';
  }

  public webSocketFrameSent({
    requestId,
    timestamp,
    response
  }: Protocol.Network.WebSocketFrameSentEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.addProtocolFrame(response, timestamp, true);
    entry.responseReceivedTime = timestamp;
  }

  public webSocketFrameReceived({
    requestId,
    timestamp,
    response
  }: Protocol.Network.WebSocketFrameReceivedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.addProtocolFrame(response, timestamp, false);
    entry.responseReceivedTime = timestamp;
  }

  public webSocketFrameError({
    errorMessage,
    requestId,
    timestamp
  }: Protocol.Network.WebSocketFrameErrorEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    entry.addProtocolFrameError(errorMessage, timestamp);
    entry.responseReceivedTime = timestamp;
  }

  public webSocketClosed({
    requestId,
    timestamp
  }: Protocol.Network.WebSocketClosedEvent): void {
    const entry: NetworkRequest | undefined = this._entries.get(requestId);

    if (!entry) {
      return;
    }

    this.finishRequest(entry, timestamp, -1);
  }

  public requestWillBeSentExtraInfo({
    requestId,
    headers,
    associatedCookies
  }: Protocol.Network.RequestWillBeSentExtraInfoEvent): void {
    this.getExtraInfoBuilder(requestId).addRequestExtraInfo({
      requestHeaders: this.headersMapToHeadersArray(headers),
      // A cookie with a blocked reason was not sent with the request.
      requestCookies: associatedCookies
        ?.filter(({ blockedReasons }) => !blockedReasons.length)
        .map(({ cookie }) => this.createCookie(cookie))
    });
  }

  public responseReceivedExtraInfo({
    requestId,
    headers,
    headersText
  }: Protocol.Network.ResponseReceivedExtraInfoEvent): void {
    this.getExtraInfoBuilder(requestId).addResponseExtraInfo({
      responseHeaders: this.headersMapToHeadersArray(headers),
      responseHeadersText: headersText
    });
  }

  private getExtraInfoBuilder(
    requestId: Protocol.Network.RequestId
  ): ExtraInfoBuilder {
    if (!this._extraInfoBuilders.has(requestId)) {
      this._extraInfoBuilders.set(
        requestId,
        new ExtraInfoBuilder((): void => {
          this._extraInfoBuilders.delete(requestId);
        })
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._extraInfoBuilders.get(requestId)!;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _appendRedirect(
    requestId: Protocol.Network.RequestId,
    time: Protocol.Network.MonotonicTime,
    redirectURL: string
  ): NetworkRequest {
    const originalNetworkRequest: NetworkRequest = this._entries.get(
      requestId
    ) as NetworkRequest;

    let redirectCount = 0;
    let redirect: NetworkRequest | undefined =
      originalNetworkRequest.redirectSource;

    while (redirect) {
      redirectCount++;
      redirect = redirect.redirectSource;
    }

    originalNetworkRequest.markAsRedirect(redirectCount);

    this.finishRequest(originalNetworkRequest, time, -1);

    const newNetworkRequest: NetworkRequest = this.createRequest(
      requestId,
      originalNetworkRequest.frameId,
      originalNetworkRequest.loaderId,
      redirectURL,
      originalNetworkRequest.documentURL,
      originalNetworkRequest.initiator
    );

    newNetworkRequest.redirectSource = originalNetworkRequest;

    return newNetworkRequest;
  }

  private finishRequest(
    networkRequest: NetworkRequest,
    finishTime: Protocol.Network.MonotonicTime,
    encodedDataLength: number
  ): void {
    networkRequest.endTime = finishTime;

    if (encodedDataLength >= 0) {
      const redirectSource: NetworkRequest | undefined =
        networkRequest.redirectSource;

      if (redirectSource?.signedExchangeInfo) {
        networkRequest.transferSize = 0;
        redirectSource.transferSize = encodedDataLength;
      } else {
        networkRequest.transferSize = encodedDataLength;
      }
    }

    this.loadContent(networkRequest);

    this.getExtraInfoBuilder(networkRequest.requestId).finished();

    if (!this.shouldExcludeRequest(networkRequest)) {
      networkRequest
        .waitForCompletion()
        .then(() => this.destination?.(networkRequest))
        .finally(() => this._entries.delete(networkRequest.requestId));
    }
  }

  private loadContent(networkRequest: NetworkRequest): void {
    if (networkRequest.mimeType && this.options.content) {
      networkRequest.setContentData(
        this.network.getResponseBody(networkRequest.requestId)
      );
    }
  }

  private startRequest(networkRequest: NetworkRequest): void {
    this._entries.set(networkRequest.requestId, networkRequest);
  }

  private updateNetworkRequestWithRequest(
    chromeRequest: NetworkRequest,
    request: Protocol.Network.Request
  ): void {
    chromeRequest.requestMethod = request.method;
    chromeRequest.requestHeaders = this.headersMapToHeadersArray(
      request.headers
    );
    chromeRequest.setRequestFormData(
      request.hasPostData
        ? this.getRequestPostData(chromeRequest, request)
        : Promise.resolve(undefined)
    );
    chromeRequest.initialPriority = request.initialPriority;
  }

  private getRequestPostData(
    request: NetworkRequest,
    rawRequest: Protocol.Network.Request
  ): Promise<string | undefined> {
    return rawRequest.postData !== undefined
      ? Promise.resolve(rawRequest.postData)
      : this.network
          .getRequestBody(request.requestId)
          .then(
            ({
              postData
            }: Protocol.Network.GetRequestPostDataResponse): string => postData
          )
          .catch(() => undefined);
  }

  private createRequest(
    requestId: Protocol.Network.RequestId,
    frameId: string | undefined,
    loaderId: Protocol.Network.LoaderId,
    url: string,
    documentURL: string,
    initiator?: Protocol.Network.Initiator
  ): NetworkRequest {
    return new NetworkRequest(
      requestId,
      url,
      documentURL,
      loaderId,
      initiator,
      frameId
    );
  }

  // eslint-disable-next-line complexity
  private updateNetworkRequestWithResponse(
    networkRequest: NetworkRequest,
    response: Protocol.Network.Response
  ): void {
    if (response.url && networkRequest.url !== response.url) {
      networkRequest.url = response.url;
    }
    networkRequest.mimeType = response.mimeType;
    networkRequest.statusCode = response.status;
    networkRequest.statusText = response.statusText;

    if (!networkRequest.hasExtraResponseInfo) {
      networkRequest.responseHeaders = this.headersMapToHeadersArray(
        response.headers
      );
    }

    if (response.encodedDataLength >= 0) {
      networkRequest.transferSize = response.encodedDataLength;
    }

    if (response.requestHeaders && !networkRequest.hasExtraRequestInfo) {
      networkRequest.requestHeaders = this.headersMapToHeadersArray(
        response.requestHeaders
      );
      networkRequest.requestHeadersText = response.requestHeadersText ?? '';
    }

    networkRequest.connectionReused = response.connectionReused;
    networkRequest.connectionId = String(response.connectionId);

    if (response.remoteIPAddress) {
      networkRequest.setRemoteAddress(
        response.remoteIPAddress,
        response.remotePort || -1
      );
    }

    if (response.timing) {
      networkRequest.timing = response.timing;
    }

    networkRequest.protocol = response.protocol ?? '';
  }

  private createCookie({
    name,
    value,
    domain,
    path,
    expires,
    session,
    httpOnly,
    secure,
    sameSite,
    size
  }: Protocol.Network.Cookie): NetworkCookie {
    const cookie = new NetworkCookie(name, value);

    cookie.size = size;
    cookie.addAttribute(CookieAttribute.DOMAIN, domain);
    cookie.addAttribute(CookieAttribute.PATH, path);

    if (!session) {
      // CDP gives the expiration time in seconds since the epoch.
      cookie.addAttribute(
        CookieAttribute.EXPIRES,
        new Date(expires * 1000).toUTCString()
      );
    }

    if (httpOnly) {
      cookie.addAttribute(CookieAttribute.HTTPONLY);
    }

    if (secure) {
      cookie.addAttribute(CookieAttribute.SECURE);
    }

    if (sameSite) {
      cookie.addAttribute(CookieAttribute.SAMESITE, sameSite);
    }

    return cookie;
  }

  private headersMapToHeadersArray(
    headersMap: Protocol.Network.Headers
  ): Header[] {
    return Object.keys(headersMap).reduce(
      (acc: Header[], name: string): Header[] => {
        const values: string[] = headersMap[name].split('\n');

        acc.push(...values.map((value: string): Header => ({ name, value })));

        return acc;
      },
      []
    );
  }

  private shouldExcludeRequest(request: NetworkRequest): boolean {
    return this.requestFilter?.wouldApply(this.options)
      ? !this.requestFilter.apply(request, this.options)
      : false;
  }

  private handleEvent({ method, params, sessionId }: NetworkEvent): void {
    const methodName = method.substring(method.indexOf('.') + 1);

    if (typeof (this as any)[methodName] === 'function') {
      (this as any)[methodName](params, sessionId);
    }
  }
}
