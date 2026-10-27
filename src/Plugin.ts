/// <reference types="cypress" preserve="true" />
import { Logger } from './utils/Logger.ts';
import { FileManager } from './utils/FileManager.ts';
import type { HarExporter } from './network/HarExporter.ts';
import type {
  HarExporterFactory,
  HarExporterOptions
} from './network/HarExporterFactory.ts';
import type { NetworkObserverOptions } from './network/NetworkObserverOptions.ts';
import type { Observer } from './network/Observer.ts';
import type { ObserverFactory } from './network/ObserverFactory.ts';
import { HarBuilder } from './network/HarBuilder.ts';
import { NetworkIdleMonitor } from './network/NetworkIdleMonitor.ts';
import { NetworkRequest } from './network/NetworkRequest.ts';
import { ErrorUtils } from './utils/ErrorUtils.ts';
import type { Connection } from './cdp/Connection.ts';
import type { ConnectionFactory } from './cdp/ConnectionFactory.ts';
import type { NetworkOptions } from './cdp/NetworkOptions.ts';
import {
  ADDRESS_OPTION_NAME,
  MAX_NETWORK_IDLE_THRESHOLD,
  MAX_NETWORK_IDLE_DURATION,
  PORT_OPTION_NAME,
  SUPPORTED_BROWSERS
} from './constants.ts';
import { join } from 'node:path';
import { EOL } from 'node:os';
import { setTimeout } from 'node:timers/promises';

export interface SaveOptions {
  fileName: string;
  outDir: string;
  waitForIdle?: boolean;
  minIdleDuration?: number;
  maxWaitDuration?: number;
}

export type RecordOptions = NetworkObserverOptions &
  HarExporterOptions &
  NetworkOptions;

interface Addr {
  port: number;
  host: string;
}

export class Plugin {
  private exporter?: HarExporter;
  private networkObservable?: Observer<NetworkRequest>;
  private addr?: Addr;
  private _connection?: Connection;
  private supported?: boolean;

  constructor(
    private readonly logger: Logger,
    private readonly fileManager: FileManager,
    private readonly connectionFactory: ConnectionFactory,
    private readonly observerFactory: ObserverFactory,
    private readonly exporterFactory: HarExporterFactory
  ) {}

  public ensureBrowserFlags(
    browser: Cypress.Browser,
    args: string[]
  ): string[] {
    this.supported = this.isSupportedBrowser(browser);
    if (!this.supported) {
      this.logger.warn(
        `HAR recording is not supported in this browser: ${browser.name}`
      );
    }

    const electronUsed = browser.name === 'electron';

    if (electronUsed) {
      args = this.parseElectronSwitches(browser);
    }

    const browserFlags: string[] = this.ensureRdpAddrArgs(args);

    return electronUsed
      ? []
      : browserFlags.filter((x: string): boolean => !args.includes(x));
  }

  public async recordHar(options: RecordOptions): Promise<void> {
    if (!this.addr) {
      throw new Error(
        `Please call the 'ensureBrowserFlags' before attempting to start the recording.`
      );
    }

    if (!this.supported) {
      return;
    }

    this.warnAboutDeprecations(options);

    await this.disposeOfHar();
    await this.closeConnection();

    this.exporter = await this.exporterFactory.create(options);
    this._connection = this.connectionFactory.create({
      ...this.addr,
      maxRetries: 20,
      maximumBackoff: 100,
      initialBackoff: 5
    });

    await this._connection.open();

    await this.listenNetworkEvents(options);
  }

  public async saveHar(options: SaveOptions): Promise<void> {
    if (!this.supported) {
      return;
    }

    const filePath = join(options.outDir, options.fileName);

    if (!this._connection) {
      this.logger.err(`Failed to save HAR. First you should start recording.`);

      return;
    }

    try {
      await this.fileManager.createFolder(options.outDir);

      if (options.waitForIdle) {
        await this.waitForNetworkIdle(options);
      }

      await this.stopObserving();

      const har: string | undefined = await this.buildHar();

      if (har) {
        await this.fileManager.writeFile(filePath, har);
      }
    } catch (e) {
      const message = ErrorUtils.isError(e) ? e.message : e;
      this.logger.err(
        `An error occurred while attempting to save the HAR file. Error details: ${message}`
      );
    } finally {
      await this.disposeOfHar();
    }
  }

  public async disposeOfHar(): Promise<void> {
    if (!this.supported) {
      return;
    }

    await this.stopObserving();
    await this.closeConnection();

    if (this.exporter) {
      this.exporter.end();
      delete this.exporter;
    }
  }

  private async stopObserving(): Promise<void> {
    await this.networkObservable?.unsubscribe();
    delete this.networkObservable;
  }

  private warnAboutDeprecations(options: RecordOptions): void {
    if (options.minStatusCodeToInclude !== undefined) {
      this.logger.deprecate(
        'minStatusCodeToInclude',
        'The `minStatusCodeToInclude` option is deprecated and will be removed in version 6. Use `excludeStatusCodes` instead.'
      );
    }

    if (options.includeBlobs === undefined) {
      this.logger.deprecate(
        'includeBlobs',
        'Version 6 stops recording blob requests by default. Pass `includeBlobs: true` to `cy.recordHar()` to keep them, or `includeBlobs: false` to opt in now.'
      );
    }
  }

  private parseElectronSwitches(browser: Cypress.Browser): string[] {
    if (!process.env.ELECTRON_EXTRA_LAUNCH_ARGS?.includes(PORT_OPTION_NAME)) {
      this.logger
        .err(`The '${browser.name}' browser was detected, however, the required '${PORT_OPTION_NAME}' command line switch was not provided. 
This switch is necessary to enable remote debugging over HTTP on the specified port. 

Please refer to the documentation:
  - https://www.electronjs.org/docs/latest/api/command-line-switches#--remote-debugging-portport
  - https://docs.cypress.io/api/plugins/browser-launch-api#Modify-Electron-app-switches`);
      throw new Error(
        `Missing '${PORT_OPTION_NAME}' command line switch for Electron browser`
      );
    }

    return process.env.ELECTRON_EXTRA_LAUNCH_ARGS.split(' ');
  }

  private async buildHar(): Promise<string | undefined> {
    if (this.exporter) {
      const content = await this.exporter.read();

      if (content) {
        const entries = content
          .split(EOL)
          .filter(Boolean)
          .map(x => JSON.parse(x));

        const har = new HarBuilder(entries).build();

        return JSON.stringify(har, null, 2);
      }
    }

    return undefined;
  }

  private waitForNetworkIdle(
    options: Pick<SaveOptions, 'minIdleDuration' | 'maxWaitDuration'>
  ): Promise<void> {
    const {
      minIdleDuration = MAX_NETWORK_IDLE_THRESHOLD,
      maxWaitDuration = MAX_NETWORK_IDLE_DURATION
    } = options;

    return Promise.race([
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      new NetworkIdleMonitor(this.networkObservable!).waitForIdle(
        minIdleDuration
      ),
      setTimeout(maxWaitDuration)
    ]);
  }

  private async listenNetworkEvents(options: RecordOptions): Promise<void> {
    const network = this._connection?.discoverNetwork(options);

    this.networkObservable = this.observerFactory.createNetworkObserver(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      network!,
      options
    );

    return this.networkObservable.subscribe((request: NetworkRequest) =>
      this.exporter?.write(request)
    );
  }

  private async closeConnection(): Promise<void> {
    if (this._connection) {
      await this._connection.close();
      delete this._connection;
    }
  }

  private isSupportedBrowser(browser: Cypress.Browser): boolean {
    return SUPPORTED_BROWSERS.includes(browser?.family);
  }

  private ensureRdpAddrArgs(args: string[]): string[] {
    const {
      host = 'localhost',
      port = 40000 + Math.round(Math.random() * 25000)
    } = this.extractAddrFromArgs(args);

    this.addr = { host, port };

    return [
      ...args,
      `${PORT_OPTION_NAME}=${port}`,
      `${ADDRESS_OPTION_NAME}=${host}`
    ];
  }

  private extractAddrFromArgs(args: string[]): Partial<Addr> {
    const port: string | undefined = this.findAndParseIfPossible(
      args,
      PORT_OPTION_NAME
    );
    const host: string | undefined = this.findAndParseIfPossible(
      args,
      ADDRESS_OPTION_NAME
    );

    let addr: { port?: number; host?: string } = {};

    if (port && !isNaN(+port)) {
      addr = { port: +port };
    }

    if (host) {
      addr = { ...addr, host };
    }

    return addr;
  }

  private findAndParseIfPossible(
    args: string[],
    optionName: string
  ): string | undefined {
    const arg: string | undefined = args.find((x: string): boolean =>
      x.startsWith(optionName)
    );
    const [, value]: string[] = arg?.split('=', 2) ?? [];

    return value;
  }
}
