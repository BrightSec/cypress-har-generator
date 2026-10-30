import { RetryStrategy } from './RetryStrategy.ts';
import { Logger } from '../utils/Logger.ts';
import {
  ATTEMPT_TO_CONNECT,
  CONNECTED,
  CONNECTION_NOT_ESTABLISHED,
  DISCONNECTED,
  FAILED_ATTEMPT_TO_CONNECT,
  FAILED_TO_CONNECT
} from './messages.ts';
import type { Connection } from './Connection.ts';
import type { Network } from '../network/Network.ts';
import type { TestStartedSource } from '../network/TestStartedSource.ts';
import { DefaultNetwork } from './DefaultNetwork.ts';
import type { NetworkOptions } from './NetworkOptions.ts';
import type { CDPClient } from './CDPClient.ts';
import CDP, { Version } from 'chrome-remote-interface';
import type { Options } from 'chrome-remote-interface';

export class CDPConnection implements Connection {
  private _network?: Network & TestStartedSource;
  private _cdp?: CDPClient;

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

      const cdp = (await CDP({
        target
      })) as CDPClient;

      this.logger.debug(CONNECTED);

      cdp.once('disconnect', (): void => this.logger.debug(DISCONNECTED));

      this._cdp = cdp;
    } catch (e) {
      this.logger.debug(FAILED_ATTEMPT_TO_CONNECT, e);

      if (
        !(await this.retryStrategy.execute((): Promise<void> => this.open()))
      ) {
        throw new Error(FAILED_TO_CONNECT, { cause: e });
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

  public discoverNetwork(
    options?: NetworkOptions
  ): Network & TestStartedSource {
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
