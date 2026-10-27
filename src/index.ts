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

export interface InstallOptions {
  /**
   * Records a HAR for each spec from the Node process, which survives a run stopped early.
   * Turn it off to record only through the `cy.recordHar` and `cy.saveHar` commands.
   * @defaultValue true
   */
  lifecycle?: boolean;
}

/**
 * Sets the plugin up in `setupNodeEvents`.
 * @param on - The `on` argument of `setupNodeEvents`.
 * @param config - The `config` argument of `setupNodeEvents`.
 * @param options - See {@link InstallOptions}.
 */
export const install = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
  { lifecycle = true }: InstallOptions = {}
): void => {
  if (!config) {
    throw new TypeError(
      '`install` requires the config: call `install(on, config)` in `setupNodeEvents(on, config)`.'
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

  warnAboutDeprecatedConfig(config);

  if (lifecycle) {
    enableLifecycle(on, config);
  }
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
};

const enableLifecycle = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
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
        rootDir: StringUtils.dirname(spec.absolute)
      })
    );
    on('after:spec', (spec: Cypress.Spec, _: CypressCommandLine.RunResult) =>
      plugin.saveHar({
        fileName: StringUtils.normalizeName(spec.name, { ext: '.har' }),
        outDir: ConfigUtils.fromNode<string>(config, HARS_FOLDER_KEYS) ?? '.'
      })
    );
  }
};

/**
 * Function has been deprecated. Use {@link install} instead as follows:
 * ```diff
 * setupNodeEvents(on, config) {
 *   install(on, config);
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
