import { StringUtils } from './utils/StringUtils.ts';
import { HostPattern } from './utils/HostPattern.ts';
import {
  DEFAULT_EXCLUDE_PATHS,
  HARS_FOLDER_KEY,
  TEST_STARTED_BINDING
} from './constants.ts';
import type { TestStart } from './network/TestStart.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';
import { HarRouter } from './replay/HarRouter.ts';
import { ReplayResponse } from './replay/ReplayResponse.ts';
import type { NotFoundAction, ReplayOptions } from './replay/ReplayOptions.ts';
import type { Entry } from 'har-format';

// Mocha documents `currentRetry` as public, while its types mark it protected
type MochaTest = Pick<Mocha.Test, 'titlePath'> & { currentRetry(): number };

let currentTest: TestStart | undefined;

// the plugin adds the function to the pages it records, so nothing is sent while no recording is active.
// A spec frame created after the recording started lacks it, while the runner page above it, of the same origin, has it.
const findBinding = (): unknown =>
  [window, window.top]
    .map(
      (x: Window | null): unknown =>
        (x as unknown as Record<string, unknown> | null)?.[TEST_STARTED_BINDING]
    )
    .find((x: unknown): boolean => typeof x === 'function');

const sendTestStart = (): void => {
  const binding: unknown = findBinding();

  if (currentTest && typeof binding === 'function') {
    binding(JSON.stringify(currentTest));
  }
};

Cypress.on('test:before:run', (_: unknown, test: Mocha.Test) => {
  currentTest = {
    spec: Cypress.spec.relative,
    titlePath: test.titlePath(),
    attempt: (test as unknown as MochaTest).currentRetry() + 1,
    startedAt: Date.now()
  };
  sendTestStart();
});

Cypress.Commands.add(
  'recordHar',
  (options?: Partial<RecordOptions>): Cypress.Chainable => {
    const { includeBaseUrlHost, ...recordOptions } = options ?? {};
    const includeHosts = HostPattern.withBaseUrlHost(
      recordOptions.includeHosts,
      includeBaseUrlHost,
      Cypress.config('baseUrl')
    );

    return cy
      .task('recordHar', {
        content: true,
        rootDir: StringUtils.dirname(Cypress.spec.absolute),
        ...recordOptions,
        excludePaths: (recordOptions.excludePaths ?? DEFAULT_EXCLUDE_PATHS).map(
          x => StringUtils.toRegexSource(x)
        ),
        includeHosts: includeHosts?.map(x => HostPattern.toSource(x)),
        excludeHosts: recordOptions.excludeHosts?.map(x =>
          HostPattern.toSource(x)
        )
        // the function exists only once the recording started, after the test did
      })
      .then(() => sendTestStart());
  }
);

Cypress.Commands.add(
  'saveHar',
  (options?: Partial<SaveOptions>): Cypress.Chainable => {
    const fallbackFileName = Cypress.spec.name;
    const outDir: string = Cypress.expose(HARS_FOLDER_KEY) ?? './';

    return cy.task('saveHar', {
      outDir,
      ...options,
      fileName: StringUtils.normalizeName(
        options?.fileName ?? fallbackFileName,
        !options?.fileName ? { ext: '.har' } : undefined
      )
    });
  }
);

Cypress.Commands.add('disposeOfHar', (): Cypress.Chainable =>
  cy.task('disposeOfHar')
);

const NOT_FOUND_ACTIONS: readonly NotFoundAction[] = ['abort', 'fallback'];

// the HAR of the spec holds the requests of all its tests, so each test goes on from where the previous one stopped
let specRouter: { spec: string; router: HarRouter } | undefined;

const cachedSpecRouter = (): HarRouter | undefined =>
  specRouter?.spec === Cypress.spec.absolute ? specRouter.router : undefined;

const routeSpecHar = (entries: Entry[]): HarRouter => {
  const router = new HarRouter(entries);

  specRouter = { spec: Cypress.spec.absolute, router };

  return router;
};

const inScope = (url: string, scope?: string | RegExp): boolean => {
  if (scope === undefined) {
    return true;
  }

  if (scope instanceof RegExp) {
    return scope.test(url);
  }

  // a subset of how `cy.intercept()` matches a string, so a static route never serves a request outside `scope`
  return url === scope || Cypress.minimatch(url, scope, { matchBase: true });
};

const intercept = (
  router: HarRouter,
  { url, notFound = 'abort' }: ReplayOptions
): void => {
  cy.intercept({ url: url ?? /.*/ }, req => {
    // a page recorded through Cypress carries the runner script Cypress injects into it, so serving it would inject the script twice
    if (req.resourceType === 'document') {
      return;
    }

    const entry: Entry | undefined = router.find(req);

    if (entry) {
      req.reply(new ReplayResponse(entry.response).toStaticResponse());
    } else if (notFound === 'abort') {
      req.destroy();
    }
  });

  // Cypress logs each request a function handler serves, which costs more than serving it, while a static
  // response can opt out with `log: false`. A route defined later is matched first, so the routes above
  // serve only the requests these do not.
  for (const { method, url: entryUrl, entry } of router.staticRoutes()) {
    if (
      entry._resourceType?.toLowerCase() === 'document' ||
      !inScope(entryUrl, url)
    ) {
      continue;
    }

    cy.intercept(
      {
        method,
        url: new RegExp(`^${StringUtils.escapeCharacters(entryUrl)}(#.*)?$`)
      },
      {
        ...new ReplayResponse(entry.response).toStaticResponse(),
        log: false
      }
    );
  }
};

const parseReplayArgs = (
  pathOrOptions?: string | ReplayOptions,
  maybeOptions?: ReplayOptions
): [string | undefined, ReplayOptions] => {
  if (StringUtils.isString(pathOrOptions)) {
    if (!pathOrOptions) {
      throw new TypeError('The path passed to `replayHar` must not be empty.');
    }

    return [pathOrOptions, maybeOptions ?? {}];
  }

  if (
    pathOrOptions !== undefined &&
    (pathOrOptions === null || typeof pathOrOptions !== 'object')
  ) {
    throw new TypeError(
      '`replayHar` takes the path to a HAR file, the options, or both.'
    );
  }

  return [undefined, pathOrOptions ?? {}];
};

Cypress.Commands.add(
  'replayHar',
  (
    pathOrOptions?: string | ReplayOptions,
    maybeOptions?: ReplayOptions
  ): Cypress.Chainable => {
    const [path, options]: [string | undefined, ReplayOptions] =
      parseReplayArgs(pathOrOptions, maybeOptions);
    const { url, notFound } = options;

    if (
      url !== undefined &&
      !StringUtils.isString(url) &&
      !(url instanceof RegExp)
    ) {
      throw new TypeError('The `url` option must be a string or a RegExp.');
    }

    if (notFound !== undefined && !NOT_FOUND_ACTIONS.includes(notFound)) {
      throw new TypeError(
        `The \`notFound\` option must be one of: ${NOT_FOUND_ACTIONS.join(', ')}.`
      );
    }

    const cached: HarRouter | undefined =
      path === undefined ? cachedSpecRouter() : undefined;

    if (cached) {
      intercept(cached, options);

      return cy.wrap(null, { log: false });
    }

    const entries: Cypress.Chainable<Entry[] | null> =
      path === undefined
        ? cy.task<Entry[] | null>(
            'replaySpecHar',
            { name: Cypress.spec.name, absolute: Cypress.spec.absolute },
            { log: false }
          )
        : cy.task<Entry[] | null>('readHar', path, { log: false });

    return entries.then(result => {
      if (result) {
        intercept(
          path === undefined ? routeSpecHar(result) : new HarRouter(result),
          options
        );
      }
    });
  }
);
