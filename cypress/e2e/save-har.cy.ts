import { env, expose } from '../support/config-sources.ts';

const sources = [expose, env];
const keys = ['hars_folder', 'HARS_FOLDER', 'hars_folders'];

describe('Save HAR', () => {
  beforeEach(() => {
    for (const source of sources.filter(x => x.supported)) {
      keys.forEach(key => source.set(key, undefined));
    }

    cy.visit('/');

    const fileName = Cypress.spec.name.replace('.ts', '.har');

    cy.tmpdir()
      .then(outDir =>
        cy.remove(`${outDir}/${fileName}`).remove(fileName).wrap({
          outDir,
          fileName
        })
      )
      .as('options');
  });

  it('does nothing when no recorded entries', () => {
    cy.recordHar();
    cy.saveHar();
    cy.get('@options')
      .its('fileName')
      .then(fileName => cy.exists(fileName).should('be.false'));
  });

  it('does nothing when recording is not initiated yet', () => {
    cy.saveHar();
    cy.get('@options')
      .its('fileName')
      .then(fileName => cy.exists(fileName).should('be.false'));
  });

  it('saves a HAR file to the root folder', () => {
    cy.recordHar();

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    cy.saveHar();
    cy.get('@options')
      .its('fileName')
      .then(fileName => cy.exists(fileName).should('be.true'));
  });

  for (const source of sources) {
    for (const key of keys) {
      // a test for an API the running Cypress version lacks is skipped instead of being removed
      (source.supported ? it : it.skip)(
        `saves a HAR file to the folder specified by the ${key} ${source.name} variable`,
        () => {
          cy.recordHar();
          cy.get('@options')
            .its('outDir')
            .then(value => source.set(key, value));

          cy.visit('/');
          cy.get('a[href$=fetch]').click();
          cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

          cy.saveHar();
          cy.get('@options')
            .its('fileName')
            .then(fileName => {
              const path = `${source.get(key)}/${fileName}`;

              cy.exists(path).should('be.true');
            });
        }
      );
    }
  }

  it('saves a HAR file to the custom folder', () => {
    cy.recordHar();

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    cy.get<{ outDir: string; fileName: string }>('@options').then(options => {
      cy.saveHar({ outDir: options.outDir });
      const path = `${options.outDir}/${options.fileName}`;
      cy.exists(path).should('be.true');
    });
  });

  it('saves a HAR file with a custom name', () => {
    cy.recordHar();

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    const fileName = 'test.json';

    cy.get<{ outDir: string; fileName: string }>('@options').then(options => {
      cy.saveHar({ fileName, outDir: options.outDir });
      const path = `${options.outDir}/${fileName}`;
      cy.exists(path).should('be.true');
    });
  });

  it('saves a HAR file with a default extension', () => {
    cy.recordHar();

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    const fileName = 'test';

    cy.get<{ outDir: string; fileName: string }>('@options').then(options => {
      cy.saveHar({ fileName, outDir: options.outDir });
      const path = `${options.outDir}/${fileName}.har`;
      cy.exists(path).should('be.true');
    });
  });
});
