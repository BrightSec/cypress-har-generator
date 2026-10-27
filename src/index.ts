import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { FileManager } from './utils/FileManager.ts';
import { DefaultConnectionFactory } from './cdp/DefaultConnectionFactory.ts';
import { DefaultHarExporterFactory } from './network/DefaultHarExporterFactory.ts';
import { DefaultObserverFactory } from './network/DefaultObserverFactory.ts';
import { StringUtils } from './utils/StringUtils.ts';
import { ConfigUtils } from './utils/ConfigUtils.ts';
import { DEPRECATED_HARS_FOLDER_KEYS, HARS_FOLDER_KEYS } from './constants.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable<Subject> {
      saveHar(options?: Partial<SaveOptions>): Chainable<Subject>;
      recordHar(options?: Partial<RecordOptions>): Chainable<Subject>;
      disposeOfHar(): Chainable<Subject>;
    }
  }
}

const plugin = new Plugin(
  Logger.Instance,
  FileManager.Instance,
  new DefaultConnectionFactory(Logger.Instance),
  new DefaultObserverFactory(Logger.Instance),
  new DefaultHarExporterFactory(FileManager.Instance, Logger.Instance)
);

/**
 * Besides `lifecycle`, takes the options of `cy.recordHar()` and `cy.saveHar()` for the HAR recorded for each spec,
 * so they take effect only with `lifecycle`. As with `cy.recordHar()`, `rootDir` defaults to the folder of the spec.
 * The HAR is named after the spec and written to `hars_folder`, so `fileName` and `outDir` are not accepted.
 */
export interface InstallOptions
  extends Partial<RecordOptions>, Omit<SaveOptions, 'fileName' | 'outDir'> {
  /**
   * Records a HAR for each spec from the Node process, which survives a run stopped early.
   * Requires `config`.
   * @defaultValue false
   */
  lifecycle?: boolean;
}

/**
 * Sets the plugin up in `setupNodeEvents`.
 * @param on - The `on` argument of `setupNodeEvents`.
 * @param config - The `config` argument of `setupNodeEvents`, required by the `lifecycle` option.
 * @param options - See {@link InstallOptions}.
 */
export const install = (
  on: Cypress.PluginEvents,
  config?: Cypress.PluginConfigOptions,
  { lifecycle = false, ...harOptions }: InstallOptions = {}
): void => {
  if (lifecycle && !config) {
    throw new TypeError(
      'The `lifecycle` option requires the config: call `install(on, config, { lifecycle: true })`.'
    );
  }

  // ADHOC: Cypress expect the return value to be null to signal that the given event has been handled properly.
  // https://docs.cypress.io/api/commands/task#Usage
  on('task', {
    saveHar: async (options: SaveOptions): Promise<null> => {
      await plugin.saveHar(options);

      return null;
    },
    recordHar: async (options: RecordOptions): Promise<null> => {
      await plugin.recordHar(options);

      return null;
    },
    disposeOfHar: async (): Promise<null> => {
      await plugin.disposeOfHar();

      return null;
    }
  });

  on(
    'before:browser:launch',
    (
      browser: Cypress.Browser | null,
      launchOptions: Cypress.BeforeBrowserLaunchOptions
    ) => {
      ensureBrowserFlags((browser ?? {}) as Cypress.Browser, launchOptions);

      return launchOptions;
    }
  );

  if (config) {
    warnAboutDeprecatedConfig(config);
  }

  if (config && lifecycle) {
    enableLifecycle(on, config, harOptions);
  } else if (Object.keys(harOptions).length > 0) {
    Logger.Instance.warn(
      'The recording and saving options passed to `install` apply only to the HAR recorded for each spec: call `install(on, config, { lifecycle: true, ... })`.'
    );
  }
};

/**
 * @deprecated Will be removed in version 6. Use `install(on, config, { lifecycle: true })` instead.
 */
export const enableExperimentalLifecycle = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): void => {
  Logger.Instance.deprecate(
    'enableExperimentalLifecycle',
    '`enableExperimentalLifecycle(on, config)` is deprecated and will be removed in version 6. Use `install(on, config, { lifecycle: true })` instead.'
  );
  warnAboutDeprecatedConfig(config);
  enableLifecycle(on, config);
};

const warnAboutDeprecatedConfig = (
  config: Cypress.PluginConfigOptions
): void => {
  if (ConfigUtils.fromNode(config, DEPRECATED_HARS_FOLDER_KEYS) !== undefined) {
    Logger.Instance.deprecate(
      'hars_folders',
      'The `hars_folders` variable is deprecated and will be removed in version 6. Rename it to `hars_folder`, or `CYPRESS_HARS_FOLDERS` to `CYPRESS_hars_folder`.'
    );
  }

  if (!config.version) {
    return;
  }

  if (!supportsExpose(config.version)) {
    Logger.Instance.deprecate(
      'cypress-version',
      `Cypress ${config.version} is deprecated: version 6 of the plugin requires Cypress 15.10.0 or later, which adds \`Cypress.expose()\`.`
    );
  } else if (
    ConfigUtils.fromNode({ expose: config.expose }, HARS_FOLDER_KEYS) ===
      undefined &&
    ConfigUtils.fromNode({ env: config.env }, HARS_FOLDER_KEYS) !== undefined
  ) {
    Logger.Instance.deprecate(
      'hars_folder-env',
      'Reading `hars_folder` from `env`, `--env` or `CYPRESS_hars_folder` is deprecated and will be removed in version 6. Set it in `expose`, or pass `--expose hars_folder=...`, instead.'
    );
  }
};

const supportsExpose = (version: string): boolean => {
  const [major = 0, minor = 0]: number[] = version.split('.').map(Number);

  return major > 15 || (major === 15 && minor >= 10);
};

const enableLifecycle = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
  {
    waitForIdle,
    minIdleDuration,
    maxWaitDuration,
    ...recordOptions
  }: Omit<InstallOptions, 'lifecycle'> = {}
): void => {
  // FIXME: `isInteractive` is always true. For details see https://github.com/cypress-io/cypress/issues/20789
  if (!config.isTextTerminal && !config.experimentalInteractiveRunEvents) {
    Logger.Instance.warn(
      'To record a HAR for each spec, you must either disable the interactive mode or activate the "experimentalInteractiveRunEvents" feature. For further information, please refer to: https://docs.cypress.io/guides/references/experiments#Configuration'
    );
  } else {
    on('before:spec', (spec: Cypress.Spec) =>
      plugin.recordHar({
        content: true,
        includeBlobs: true,
        rootDir: StringUtils.dirname(spec.absolute),
        ...recordOptions
      })
    );
    on('after:spec', (spec: Cypress.Spec, _: CypressCommandLine.RunResult) =>
      plugin.saveHar({
        waitForIdle,
        minIdleDuration,
        maxWaitDuration,
        fileName: StringUtils.normalizeName(spec.name, { ext: '.har' }),
        outDir: ConfigUtils.fromNode<string>(config, HARS_FOLDER_KEYS) ?? '.'
      })
    );
  }
};

/**
 * Function has been deprecated. Use {@link install} instead as follows:
 * ```diff
 * setupNodeEvents(on) {
 *   install(on);
 * -  // bind to the event we care about
 * -  on('before:browser:launch', (browser = {}, launchOptions) => {
 * -    ensureBrowserFlags(browser, launchOptions);
 * -    return launchOptions;
 * -  });
 * }
 * ```
 * In case of any issues please refer to {@link https://github.com/cypress-io/cypress/issues/5240}
 */
export const ensureBrowserFlags = (
  browser: Cypress.Browser,
  launchOptions: Cypress.BeforeBrowserLaunchOptions
): void => {
  launchOptions.args.push(
    ...plugin.ensureBrowserFlags(browser, launchOptions.args)
  );
};

export type { SaveOptions, RecordOptions } from './Plugin.ts';
