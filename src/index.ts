import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { FileManager } from './utils/FileManager.ts';
import { DefaultConnectionFactory } from './cdp/DefaultConnectionFactory.ts';
import { DefaultHarExporterFactory } from './network/DefaultHarExporterFactory.ts';
import { DefaultObserverFactory } from './network/DefaultObserverFactory.ts';
import { StringUtils } from './utils/StringUtils.ts';
import { HostPattern } from './utils/HostPattern.ts';
import { DEFAULT_EXCLUDE_PATHS, HARS_FOLDER_KEY } from './constants.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';
import picomatch from 'picomatch';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
 * so `lifecycle: false` turns them off. As with `cy.recordHar()`, `rootDir` defaults to the folder of the spec.
 * The HAR is named after the spec and written to `hars_folder`, so `fileName` and `outDir` are not accepted.
 */
export interface InstallOptions
  extends Partial<RecordOptions>, Omit<SaveOptions, 'fileName' | 'outDir'> {
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
  { lifecycle = true, ...harOptions }: InstallOptions = {}
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
      launchOptions.args.push(
        ...plugin.ensureBrowserFlags(
          (browser ?? {}) as Cypress.Browser,
          launchOptions.args
        )
      );

      return launchOptions;
    }
  );

  if (lifecycle) {
    enableLifecycle(on, config, harOptions);
  } else if (Object.keys(harOptions).length > 0) {
    Logger.Instance.warn(
      'The recording and saving options passed to `install` apply only to the HAR recorded for each spec, which `lifecycle: false` turns off.'
    );
  }
};

const enableLifecycle = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
  {
    waitForIdle,
    minIdleDuration,
    maxWaitDuration,
    includeBaseUrlHost,
    ...recordOptions
  }: Omit<InstallOptions, 'lifecycle'> = {}
): void => {
  if (includeBaseUrlHost !== undefined) {
    recordOptions.includeHosts = HostPattern.withBaseUrlHost(
      recordOptions.includeHosts,
      includeBaseUrlHost,
      config.baseUrl
    );
  }

  // FIXME: `isInteractive` is always true. For details see https://github.com/cypress-io/cypress/issues/20789
  if (!config.isTextTerminal && !config.experimentalInteractiveRunEvents) {
    Logger.Instance.warn(
      'To record a HAR for each spec, you must either disable the interactive mode or activate the "experimentalInteractiveRunEvents" feature. For further information, please refer to: https://docs.cypress.io/guides/references/experiments#Configuration'
    );
  } else {
    on('before:spec', (spec: Cypress.Spec) =>
      plugin.recordHar({
        content: true,
        excludePaths: [...DEFAULT_EXCLUDE_PATHS],
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
        outDir: join(
          config.expose?.[HARS_FOLDER_KEY] ?? '.',
          specFolder(spec, config)
        )
      })
    );
  }
};

// keeps the folders below the fixed start of `specPattern`, so specs with the same name in different folders do not overwrite each other's HAR
const specFolder = (
  spec: Cypress.Spec,
  { projectRoot, specPattern }: Cypress.PluginConfigOptions
): string => {
  const specDir = dirname(spec.absolute);
  const [folder = '']: string[] = [specPattern ?? []]
    .flat()
    .filter(pattern => typeof pattern === 'string')
    .map(pattern => picomatch.scan(pattern, { unescape: true }))
    .filter(({ negated }) => !negated)
    .map(({ base, isGlob }) =>
      relative(resolve(projectRoot, isGlob ? base : dirname(base)), specDir)
    )
    // a folder outside the base would let the HAR escape `hars_folder`
    .filter(x => !isAbsolute(x) && x !== '..' && !x.startsWith(`..${sep}`))
    .sort((a, b) => a.length - b.length);

  return folder;
};

export type { SaveOptions, RecordOptions, HostScopeOptions } from './Plugin.ts';
