import { StringUtils } from './utils/StringUtils.ts';
import { HostPattern } from './utils/HostPattern.ts';
import { DEFAULT_EXCLUDE_PATHS, HARS_FOLDER_KEY } from './constants.ts';
import type { RecordOptions, SaveOptions } from './Plugin.ts';

Cypress.Commands.add(
  'recordHar',
  (options?: Partial<RecordOptions>): Cypress.Chainable => {
    const { includeBaseUrlHost, ...recordOptions } = options ?? {};
    const includeHosts = HostPattern.withBaseUrlHost(
      recordOptions.includeHosts,
      includeBaseUrlHost,
      Cypress.config('baseUrl')
    );

    return cy.task('recordHar', {
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
    });
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
