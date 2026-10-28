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
import { HarTests } from './network/HarTests.ts';
import type { TestFilter, TestTimeline } from './network/TestTimeline.ts';
import { NetworkIdleMonitor } from './network/NetworkIdleMonitor.ts';
import { NetworkRequest } from './network/NetworkRequest.ts';
import { ErrorUtils } from './utils/ErrorUtils.ts';
import type { Connection } from './cdp/Connection.ts';
import type { TestStartedSource } from './network/TestStartedSource.ts';
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
import { setTimeout } from 'node:timers/promises';

export interface SaveOptions {
  fileName: string;
  outDir: string;
  /**
   * Waits for the pending requests to finish, up to `maxWaitDuration`, before saving.
   * @defaultValue true
   */
  waitForIdle?: boolean;
  minIdleDuration?: number;
  maxWaitDuration?: number;
}

// what `install` saves for each spec, which a function can be part of, unlike the options `cy.task` sends as JSON
export interface SpecSaveOptions extends SaveOptions {
  /**
   * Keeps only the entries sent by the tests it accepts, and writes no HAR when none is left.
   */
  keep?: TestFilter;
}

export interface HostScopeOptions {
  /**
   * Adds the host of the Cypress `baseUrl`, with its port, to {@link NetworkObserverOptions.includeHosts},
   * so only requests to the app under test and the hosts given there are recorded.
   * Throws a `TypeError` when `baseUrl` is not set.
   * @defaultValue false
   */
  includeBaseUrlHost?: boolean;
}

export type RecordOptions = NetworkObserverOptions &
  HarExporterOptions &
  NetworkOptions &
  HostScopeOptions;

interface Addr {
  port: number;
  host: string;
}

export class Plugin {
  private exporter?: HarExporter;
  private networkObservable?: Observer<NetworkRequest>;
  private testStartedSource?: TestStartedSource;
  private addr?: Addr;
  private _connection?: Connection;
  private supported?: boolean;
  // kept across recordings, as a spec can record again within a test that started before
  private readonly tests = new HarTests();

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
        `The plugin's 'before:browser:launch' listener did not run, so the browser was started without a debugging port. Another 'before:browser:launch' listener may have replaced it: see https://github.com/cypress-io/cypress/issues/5240.`
      );
    }

    if (!this.supported) {
      return;
    }

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

  public async saveHar(options: SpecSaveOptions): Promise<void> {
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

      if (options.waitForIdle ?? true) {
        await this.waitForNetworkIdle(options);
      }

      await this.stopObserving();

      const har: AsyncIterable<string> | undefined =
        await this.buildHar(options);

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
    this.testStartedSource?.offTestStarted();
    delete this.testStartedSource;
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

  private async buildHar({
    keep
  }: Pick<SpecSaveOptions, 'keep'>): Promise<
    AsyncIterable<string> | undefined
  > {
    const timeline: TestTimeline = this.tests.timeline();
    const har = await this.exporter?.read(
      keep ? timeline.only(keep) : timeline
    );

    return har
      ? new HarBuilder(har.entries, har.pages, har.tests).build()
      : undefined;
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

    this.testStartedSource = network;
    network?.onTestStarted((payload: string) => this.tests.start(payload));

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
