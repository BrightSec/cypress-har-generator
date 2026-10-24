import { NetworkRequest } from './NetworkRequest';
import type { Header } from 'har-format';

export interface RequestExtraInfo {
  requestHeaders: Header[];
}

export interface ResponseExtraInfo {
  responseHeaders: Header[];
  responseHeadersText?: string;
}

export class ExtraInfoBuilder {
  private _hasExtraInfo: boolean = false;
  private _finished: boolean = false;
  private readonly _requests: (NetworkRequest | undefined)[] = [];
  private readonly _requestExtraInfo: RequestExtraInfo[] = [];
  private readonly _responseExtraInfo: ResponseExtraInfo[] = [];

  constructor(private readonly deleteCallback: () => void) {}

  public addRequest(request: NetworkRequest): void {
    this._requests.push(request);
    this.sync();
  }

  // Holds the place of a request whose extra info arrives but which was never
  // observed, so that its extra info is not applied to the next request.
  public addUnseenRequest(): void {
    this._requests.push(undefined);
  }

  public addRequestExtraInfo(info: RequestExtraInfo): void {
    this._requestExtraInfo.push(info);
    this._hasExtraInfo = true;
    this.sync();
  }

  public addResponseExtraInfo(info: ResponseExtraInfo): void {
    this._responseExtraInfo.push(info);
    this.sync();
  }

  public finished(): void {
    this._finished = true;
    this.deleteIfComplete();
  }

  private deleteIfComplete(): void {
    if (!this._finished) {
      return;
    }

    if (this._hasExtraInfo) {
      const lastRequest: NetworkRequest | undefined = this.getLastRequest();

      if (!lastRequest?.hasExtraResponseInfo) {
        return;
      }
    }

    this.deleteCallback();
  }

  private getLastRequest(): NetworkRequest | undefined {
    return this._requests[this._requests.length - 1];
  }

  private getRequestIndex(req: NetworkRequest): number {
    return this._requests.indexOf(req);
  }

  private sync(): void {
    const req: NetworkRequest | undefined = this.getLastRequest();

    if (!req) {
      return;
    }

    const index: number = this.getRequestIndex(req);

    const requestExtraInfo: RequestExtraInfo | undefined =
      this._requestExtraInfo[index];

    if (requestExtraInfo) {
      req.addExtraRequestInfo(requestExtraInfo);
      delete this._requestExtraInfo[index];
    }

    const responseExtraInfo: ResponseExtraInfo | undefined =
      this._responseExtraInfo[index];
    if (responseExtraInfo) {
      req.addExtraResponseInfo(responseExtraInfo);
      delete this._responseExtraInfo[index];
    }

    this.deleteIfComplete();
  }
}
