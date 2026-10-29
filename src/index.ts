import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { FileManager } from './utils/FileManager.ts';
import { DefaultConnectionFactory } from './cdp/DefaultConnectionFactory.ts';
import { DefaultHarExporterFactory } from './network/DefaultHarExporterFactory.ts';
import { DefaultObserverFactory } from './network/DefaultObserverFactory.ts';
import { StringUtils } from './utils/StringUtils.ts';
import { HostPattern } from './utils/HostPattern.ts';
import {
  DEFAULT_EXCLUDE_PATHS,
  HARS_FOLDER_KEY,
  HARS_UPDATE_KEY
} from './constants.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';
import { HarReader } from './replay/HarReader.ts';
import { TestResults } from './TestResults.ts';
import type { RecordedHar } from './replay/RecordedHar.ts';
import type { ReplayOptions, UpdateMode } from './replay/ReplayOptions.ts';
import picomatch from 'picomatch';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable<Subject> {
      /**
       * Stops recording and writes the requests recorded since `cy.recordHar()` to a HAR file.
       * @param options - See {@link SaveOptions}.
       * @example
       * ```js
       * cy.saveHar({ fileName: 'example.com.har', outDir: './hars' });
       * ```
       */
      saveHar(options?: Partial<SaveOptions>): Chainable<Subject>;
      /**
       * Starts recording the requests of the browser, to be written to a HAR by `cy.saveHar()`.
       * @param options - See {@link RecordOptions}.
       * @example
       * ```js
       * cy.recordHar({ includeHosts: ['api.example.com'], content: false });
       * ```
       */
      recordHar(options?: Partial<RecordOptions>): Chainable<Subject>;
      /**
       * Stops recording and drops the recorded requests without writing a HAR.
       */
      disposeOfHar(): Chainable<Subject>;
      /**
       * Serves the matching requests with the responses recorded in the HAR of the spec, the one written for each spec to `hars_folder`.
       * Without that HAR, lets the requests reach the network so the spec records it, as `hars_update` in `expose` sets.
       * @param options - See {@link ReplayOptions}.
       * @example
       * ```js
       * beforeEach(() => cy.replayHar({ url: '/api/**' }));
       * ```
       */
      replayHar(options?: ReplayOptions): Chainable<null>;
      /**
       * Serves the matching requests with the responses recorded in a HAR file, which works without recording.
       * @param path - The path to the HAR file, relative to the project root.
       * @param options - See {@link ReplayOptions}.
       * @example
       * ```js
       * cy.replayHar('cypress/fixtures/checkout.har', { notFound: 'fallback' });
       * ```
       */
      replayHar(path: string, options?: ReplayOptions): Chainable<null>;
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
const harReader = new HarReader(FileManager.Instance);
const UPDATE_MODES: readonly UpdateMode[] = ['missing', 'all', 'none'];

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
  /**
   * Keeps only the entries sent by the tries of the tests that failed, and writes no HAR for a spec where none failed.
   * Cypress reports the results only in `cypress run`, so `cypress open` keeps every entry.
   * @defaultValue false
   */
  failedTestsOnly?: boolean;
}

/**
 * Sets the plugin up in `setupNodeEvents`. Throws a `TypeError` when `config` is missing.
 * @param on - The `on` argument of `setupNodeEvents`.
 * @param config - The `config` argument of `setupNodeEvents`.
 * @param options - See {@link InstallOptions}.
 * @example
 * ```ts
 * import { install } from '@neuralegion/cypress-har-generator';
 * import { defineConfig } from 'cypress';
 *
 * export default defineConfig({
 *   e2e: {
 *     setupNodeEvents(on, config) {
 *       install(on, config, { failedTestsOnly: true });
 *     }
 *   }
 * });
 * ```
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

  if (
    harOptions.failedTestsOnly !== undefined &&
    typeof harOptions.failedTestsOnly !== 'boolean'
  ) {
    throw new TypeError('The `failedTestsOnly` option must be a boolean.');
  }

  // the specs that replay their HAR, which must not be overwritten with the replayed responses
  const replayedSpecs = new Set<string>();
  const recordsSpecs: boolean =
    lifecycle &&
    (config.isTextTerminal || !!config.experimentalInteractiveRunEvents);
  const replaySpecHar = createReplaySpecHar(
    config,
    recordsSpecs,
    replayedSpecs
  );

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
    },
    readHar: (path: string): Promise<RecordedHar> =>
      harReader.read(resolve(config.projectRoot, path)),
    replaySpecHar
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
    enableLifecycle(on, config, harOptions, replayedSpecs);
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
    failedTestsOnly = false,
    ...recordOptions
  }: Omit<InstallOptions, 'lifecycle'>,
  replayedSpecs: Set<string>
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
    on(
      'after:spec',
      (
        spec: Cypress.Spec,
        results?: CypressCommandLine.RunResult
      ): Promise<void> => {
        if (replayedSpecs.delete(spec.absolute)) {
          return plugin.disposeOfHar();
        }

        const path = specHarPath(spec, config);
        const tests: TestResults | undefined = results
          ? new TestResults(results.tests)
          : undefined;

        return plugin.saveHar({
          waitForIdle,
          minIdleDuration,
          maxWaitDuration,
          fileName: basename(path),
          outDir: dirname(path),
          ...(tests ? { stateOf: tests.stateOf } : {}),
          ...(failedTestsOnly && tests ? { keep: tests.failed } : {})
        });
      }
    );
  }
};

// `null` lets the requests reach the network, so the HAR recorded for the spec becomes the one to replay
const createReplaySpecHar = (
  config: Cypress.PluginConfigOptions,
  recordsSpecs: boolean,
  replayedSpecs: Set<string>
): ((
  spec: Pick<Cypress.Spec, 'name' | 'absolute'>
) => Promise<RecordedHar | null>) => {
  const update: UpdateMode = config.expose?.[HARS_UPDATE_KEY] ?? 'missing';

  if (!UPDATE_MODES.includes(update)) {
    throw new TypeError(
      `The \`${HARS_UPDATE_KEY}\` key of \`expose\` must be one of: ${UPDATE_MODES.join(', ')}.`
    );
  }

  return async spec => {
    const path = resolve(config.projectRoot, specHarPath(spec, config));

    if (update !== 'all' && (await FileManager.Instance.pathExists(path))) {
      replayedSpecs.add(spec.absolute);

      return harReader.read(path);
    }

    if (update === 'none') {
      throw new Error(
        `There is no HAR to replay at ${path}, and \`${HARS_UPDATE_KEY}: 'none'\` does not let the spec record it.`
      );
    }

    if (!recordsSpecs) {
      throw new Error(
        `There is no HAR to replay at ${path}. To record it, run the spec with the HAR recorded for each spec, which \`lifecycle: false\` and the interactive mode turn off.`
      );
    }

    return null;
  };
};

const specHarPath = (
  spec: Pick<Cypress.Spec, 'name' | 'absolute'>,
  config: Cypress.PluginConfigOptions
): string =>
  join(
    config.expose?.[HARS_FOLDER_KEY] ?? '.',
    specFolder(spec, config),
    StringUtils.normalizeName(spec.name, { ext: '.har' })
  );

// keeps the folders below the fixed start of `specPattern`, so specs with the same name in different folders do not overwrite each other's HAR
const specFolder = (
  spec: Pick<Cypress.Spec, 'absolute'>,
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
export type {
  ReplayOptions,
  NotFoundAction,
  UpdateMode
} from './replay/ReplayOptions.ts';
