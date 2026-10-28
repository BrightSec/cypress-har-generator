import { StringUtils } from './utils/StringUtils.ts';
import { DEFAULT_EXCLUDE_PATHS, HARS_FOLDER_KEY } from './constants.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';
import { HarRouter } from './replay/HarRouter.ts';
import { ReplayResponse } from './replay/ReplayResponse.ts';
import type { NotFoundAction, ReplayOptions } from './replay/ReplayOptions.ts';
import type { Entry } from 'har-format';

Cypress.Commands.add(
  'recordHar',
  (options?: Partial<RecordOptions>): Cypress.Chainable =>
    cy.task('recordHar', {
      content: true,
      rootDir: StringUtils.dirname(Cypress.spec.absolute),
      ...options,
      excludePaths: (options?.excludePaths ?? DEFAULT_EXCLUDE_PATHS).map(x =>
        StringUtils.toRegexSource(x)
      ),
      includeHosts: options?.includeHosts?.map(x =>
        StringUtils.toRegexSource(x)
      )
    })
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

const routeSpecHar = (entries: Entry[]): HarRouter => {
  if (specRouter?.spec !== Cypress.spec.absolute) {
    specRouter = {
      spec: Cypress.spec.absolute,
      router: new HarRouter(entries)
    };
  }

  return specRouter.router;
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
    const { url, notFound = 'abort' } = options;

    if (
      url !== undefined &&
      !StringUtils.isString(url) &&
      !(url instanceof RegExp)
    ) {
      throw new TypeError('The `url` option must be a string or a RegExp.');
    }

    if (!NOT_FOUND_ACTIONS.includes(notFound)) {
      throw new TypeError(
        `The \`notFound\` option must be one of: ${NOT_FOUND_ACTIONS.join(', ')}.`
      );
    }

    const entries: Cypress.Chainable<Entry[] | null> =
      path === undefined
        ? cy.task<Entry[] | null>('replaySpecHar', {
            name: Cypress.spec.name,
            absolute: Cypress.spec.absolute
          })
        : cy.task<Entry[] | null>('readHar', path);

    return entries.then(result => {
      if (!result) {
        return;
      }

      const router: HarRouter =
        path === undefined ? routeSpecHar(result) : new HarRouter(result);

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
    });
  }
);
