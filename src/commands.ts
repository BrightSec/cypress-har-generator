import { StringUtils } from './utils/StringUtils.ts';
import { HostPattern } from './utils/HostPattern.ts';
import { type BrowserConfigSource, ConfigUtils } from './utils/ConfigUtils.ts';
import { HARS_FOLDER_KEYS } from './constants.ts';
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
      excludePaths: recordOptions.excludePaths?.map(x =>
        StringUtils.toRegexSource(x)
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
    const outDir =
      ConfigUtils.fromBrowser<string>(
        Cypress as BrowserConfigSource,
        HARS_FOLDER_KEYS
      ) ?? './';

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
