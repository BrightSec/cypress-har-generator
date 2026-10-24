describe('Record network issues', () => {
  const url = 'https://unknown-non-well-defined-host.cypress.test.org';

  beforeEach(() => {
    cy.once('fail', () => false);
    cy.intercept(url).as('err');
  });

  afterEach(() => {
    cy.wait('@err').its('error.code').should('eq', 'ENOTFOUND');

    cy.saveHar({ waitForIdle: true });

    cy.findHar().its('log.entries').should('contain.something.like', {
      request: {
        url
      }
    });
  });

  it('records a request failed due DNS issues', () => {
    cy.visit('/');
    cy.recordHar();

    cy.window().then(win => win.fetch(url).catch(() => undefined));
  });
});
