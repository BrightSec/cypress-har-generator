import { Entry } from 'har-format';

describe('Save HAR', () => {
  beforeEach(() => {
    Cypress.expose('hars_folder', undefined);

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

  it('saves a HAR file to the folder specified by the hars_folder expose variable', () => {
    cy.recordHar();
    cy.get<string>('@options')
      .its('outDir')
      .then(value => Cypress.expose('hars_folder', value));

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    cy.saveHar();
    cy.get('@options')
      .its('fileName')
      .then(fileName => {
        const path = `${Cypress.expose('hars_folder')}/${fileName}`;

        cy.exists(path).should('be.true');
      });
  });

  it('saves a HAR file to the nested hars_folder that does not exist yet', () => {
    cy.recordHar();

    cy.visit('/');
    cy.get('a[href$=fetch]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 1);

    cy.get<{ outDir: string; fileName: string }>('@options').then(options => {
      const root = `${options.outDir}/${options.fileName}.nested`;

      cy.remove(root).then(() => Cypress.expose('hars_folder', `${root}/a/b`));
      cy.saveHar();
      cy.exists(`${root}/a/b/${options.fileName}`).should('be.true');
      cy.remove(root);
    });
  });

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

  it('saves a large response body without waiting for idle', () => {
    const size = 50 * 1024 ** 2;

    cy.recordHar({
      maxTotalBufferSize: 256 * 1024 ** 2,
      maxResourceBufferSize: 256 * 1024 ** 2
    });

    cy.get('a[href$=large-body]').click();
    cy.get('#result', { timeout: 30000 }).should(
      'have.text',
      `Received ${size} characters`
    );

    cy.saveHar();

    cy.findHar()
      .its('log.entries')
      .should((entries: Entry[]) => {
        const entry = entries.find(({ request }: Entry) =>
          request.url.endsWith('/api/large-body')
        );
        expect(entry?.response.content.text).to.have.length(size);
      });
  });
});
