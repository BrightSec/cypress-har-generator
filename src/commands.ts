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

Cypress.Commands.add(
  'replayHar',
  (path: string, options: ReplayOptions = {}): Cypress.Chainable => {
    if (!StringUtils.isString(path) || !path) {
      throw new TypeError('`replayHar` requires the path to a HAR file.');
    }

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

    return cy.task<Entry[]>('readHar', path).then(entries => {
      const router = new HarRouter(entries);

      cy.intercept({ url: url ?? /.*/ }, req => {
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
