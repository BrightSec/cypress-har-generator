import { NetworkRequest } from './NetworkRequest.ts';
import { NetworkCookie } from './NetworkCookie.ts';
import type { ContentData } from './NetworkRequest.ts';
import type {
  Content,
  Cookie,
  Entry,
  Param,
  PostData,
  Request,
  Response,
  Timings
} from 'har-format';

export class EntryBuilder {
  constructor(private readonly request: NetworkRequest) {}

  public async build(): Promise<Entry> {
    let serverIPAddress: string = this.request.remoteAddress;

    const portPositionInString: number = serverIPAddress.lastIndexOf(':');

    if (portPositionInString !== -1) {
      serverIPAddress = serverIPAddress.substr(0, portPositionInString);
    }

    const timings: Timings = this.buildTimings();

    const time: number = Object.values(timings).reduce(
      (acc: number, t: number): number => acc + Math.max(t, 0),
      0
    );

    const entry: any = {
      startedDateTime: new Date(
        this.request.getWallTime(this.request.issueTime) * 1000
      ).toJSON(),
      time,
      timings,
      request: await this.buildRequest(),
      response: await this.buildResponse(),
      cache: {},
      // ADHOC: We should remove square brackets for IPv6 address (https://tools.ietf.org/html/rfc2373#section-2.2).
      serverIPAddress: serverIPAddress.replace(/[[\]]/g, ''),
      _priority: this.request.priority,
      _resourceType: this.request.resourceType,
      _webSocketMessages: this.request.frames ?? [],
      _eventSourceMessages: this.request.eventSourceMessages ?? []
    };

    if (this.request.connectionId !== '0') {
      entry.connection = this.request.connectionId;
    }

    return entry;
  }

  private getResponseBodySize(): number {
    if (this.request.statusCode === 304) {
      return 0;
    }

    if (!this.request.responseHeadersText) {
      return -1;
    }

    const bodySize: number =
      this.request.transferSize - this.request.responseHeadersText.length;

    // The transfer size does not always cover the headers, e.g. Chrome reports
    // none for a WebSocket handshake or a CORS preflight.
    return bodySize < 0 ? -1 : bodySize;
  }

  private getResponseCompression(): number | undefined {
    if (this.request.statusCode === 304 || this.request.statusCode === 206) {
      return undefined;
    }

    const bodySize: number = this.getResponseBodySize();

    if (bodySize === -1) {
      return undefined;
    }

    return this.request.resourceSize - bodySize;
  }

  private toMilliseconds(time: number): number {
    return time === -1 ? -1 : time * 1000;
  }

  private async buildRequest(): Promise<Request> {
    const res: Request = {
      method: this.request.requestMethod,
      url: this.buildRequestURL(this.request.url),
      httpVersion: this.request.requestHttpVersion,
      headers: this.request.requestHeaders,
      queryString: [...(this.request.queryParameters ?? [])],
      cookies: this.buildCookies(this.request.requestCookies ?? []),
      headersSize: this.request.requestHeadersText
        ? this.request.requestHeadersText.length
        : -1,
      bodySize: await this.requestBodySize()
    };

    const postData: PostData | undefined = await this.buildPostData();

    if (postData) {
      res.postData = postData;
    }

    return res;
  }

  private async buildResponse(): Promise<Response> {
    return {
      status: this.request.statusCode,
      statusText: this.request.statusText,
      httpVersion: this.request.responseHttpVersion(),
      headers: this.request.responseHeaders,
      cookies: this.buildCookies(this.request.responseCookies || []),
      content: await this.buildContent(),
      redirectURL: this.request.responseHeaderValue('Location') ?? '',
      headersSize: this.request.responseHeadersText
        ? this.request.responseHeadersText.length
        : -1,
      bodySize: this.getResponseBodySize(),
      _transferSize: this.request.transferSize
    };
  }

  private async buildContent(): Promise<Content> {
    const data: ContentData | undefined = await this.request.contentData();

    return Object.assign(
      {
        size: this.request.resourceSize,
        mimeType: this.request.mimeType || 'x-unknown',
        compression: this.getResponseCompression() ?? undefined
      },
      data
    );
  }

  // eslint-disable-next-line complexity
  private buildTimings(): Timings {
    const timing = this.request.timing;
    const issueTime: number = this.request.issueTime;
    const startTime: number = this.request.startTime;

    const result: Timings = {
      blocked: -1,
      dns: -1,
      ssl: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: 0
    };

    const queuedTime: number =
      issueTime < startTime ? startTime - issueTime : -1;
    result.blocked = this.toMilliseconds(queuedTime);

    let highestTime = 0;

    if (timing) {
      const blockedStart = this.leastNonNegative([
        timing.dnsStart,
        timing.connectStart,
        timing.sendStart
      ]);
      if (blockedStart !== Infinity) {
        result.blocked += blockedStart;
      }

      const dnsStart: any = timing.dnsEnd >= 0 ? blockedStart : 0;
      const dnsEnd: number = timing.dnsEnd >= 0 ? timing.dnsEnd : -1;
      result.dns = dnsEnd - dnsStart;

      const sslStart: number = timing.sslEnd > 0 ? timing.sslStart : 0;
      const sslEnd: number = timing.sslEnd > 0 ? timing.sslEnd : -1;
      result.ssl = sslEnd - sslStart;

      const connectStart: number =
        timing.connectEnd >= 0
          ? this.leastNonNegative([dnsEnd, blockedStart])
          : 0;
      const connectEnd: number =
        timing.connectEnd >= 0 ? timing.connectEnd : -1;
      result.connect = connectEnd - connectStart;

      const sendStart: number =
        timing.sendEnd >= 0 ? Math.max(connectEnd, dnsEnd, blockedStart) : 0;
      const sendEnd: number = timing.sendEnd >= 0 ? timing.sendEnd : 0;
      result.send = sendEnd - sendStart;

      if (result.send < 0) {
        result.send = 0;
      }

      highestTime = Math.max(
        sendEnd,
        connectEnd,
        sslEnd,
        dnsEnd,
        blockedStart,
        0
      );
    } else if (this.request.responseReceivedTime === -1) {
      result.blocked = this.request.endTime - issueTime;

      return result;
    }

    const requestTime: number = timing?.requestTime ?? startTime;
    const waitStart: number = highestTime;
    const waitEnd: number = this.toMilliseconds(
      this.request.responseReceivedTime - requestTime
    );
    result.wait = waitEnd - waitStart;

    const receiveStart: number = waitEnd;
    const receiveEnd: number = this.toMilliseconds(
      this.request.endTime - requestTime
    );
    result.receive = Math.max(receiveEnd - receiveStart, 0);

    return result;
  }

  private leastNonNegative(values: number[]): number {
    const value: number | undefined = values.find(
      (item: number): boolean => item >= 0
    );

    return value ?? -1;
  }

  private async buildPostData(): Promise<PostData | undefined> {
    const postData: string | undefined = await this.request.requestFormData();

    if (!postData) {
      return undefined;
    }

    const res: Partial<PostData> = {
      mimeType: this.request.requestContentType ?? '',
      text: postData
    };

    const formParameters: Param[] = await this.request.formParameters();

    if (formParameters) {
      res.params = [...formParameters] as never;
    }

    return res as PostData;
  }

  private buildRequestURL(url: string): string {
    return url.split('#', 2)[0];
  }

  private buildCookies(cookies: NetworkCookie[]): Cookie[] {
    return cookies.map(this.buildCookie.bind(this));
  }

  private buildCookie(cookie: NetworkCookie): Cookie {
    return {
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      domain: cookie.domain,
      expires: cookie
        .expiresDate(
          new Date(this.request.getWallTime(this.request.startTime) * 1000)
        )
        ?.toJSON(),
      httpOnly: cookie.httpOnly,
      secure: cookie.secure
    };
  }

  private async requestBodySize(): Promise<number> {
    const postData: string | undefined = await this.request.requestFormData();

    if (!postData) {
      return 0;
    }

    return this.request.contentLength;
  }
}
