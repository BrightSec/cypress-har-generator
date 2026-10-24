import { RetryStrategy } from './RetryStrategy';
import { Logger } from '../utils/Logger';
import {
  ATTEMPT_TO_CONNECT,
  CONNECTED,
  CONNECTION_NOT_ESTABLISHED,
  DISCONNECTED,
  FAILED_ATTEMPT_TO_CONNECT,
  FAILED_TO_CONNECT
} from './messages';
import type { Connection } from './Connection';
import type { Network } from '../network';
import { DefaultNetwork } from './DefaultNetwork';
import { ErrorUtils } from '../utils/ErrorUtils';
import type { NetworkOptions } from './NetworkOptions';
import CDP, { Version } from 'chrome-remote-interface';
import type { Client, Options } from 'chrome-remote-interface';

export class CDPConnection implements Connection {
  private _network?: Network;
  private _cdp?: Client;

  get cdp() {
    return this._cdp;
  }

  constructor(
    private readonly options: Options,
    private readonly logger: Logger,
    private readonly retryStrategy: RetryStrategy
  ) {}

  public async open(): Promise<void> {
    try {
      this.logger.debug(ATTEMPT_TO_CONNECT);

      const target = await this.populateBrowserTarget();

      const cdp = await CDP({
        target
      });

      this.logger.debug(CONNECTED);

      cdp.once('disconnect', (): void => this.logger.debug(DISCONNECTED));

      this._cdp = cdp;
    } catch (e) {
      const message = ErrorUtils.isError(e) ? e.message : e;
      this.logger.debug(`${FAILED_ATTEMPT_TO_CONNECT}: ${message}`);

      if (
        !(await this.retryStrategy.execute((): Promise<void> => this.open()))
      ) {
        throw new Error(FAILED_TO_CONNECT);
      }
    }
  }

  public async close(): Promise<void> {
    if (this._cdp) {
      const cdp = this._cdp;
      delete this._cdp;
      cdp.removeAllListeners();
      // Electron may never answer the closing handshake, e.g. after a spec recorded with video, so it is not awaited
      void cdp.close();
      this.logger.debug(DISCONNECTED);
    }
  }

  public discoverNetwork(options?: NetworkOptions): Network {
    if (!this.cdp) {
      throw new Error(CONNECTION_NOT_ESTABLISHED);
    }

    if (!this._network) {
      this._network = new DefaultNetwork(this.cdp, this.logger, options);
    }

    return this._network;
  }

  private async populateBrowserTarget(): Promise<string> {
    const { port, host } = this.options;
    const { webSocketDebuggerUrl } = await Version({
      host,
      port
    });

    return webSocketDebuggerUrl ?? `ws://${host}:${port}/devtools/browser`;
  }
}
