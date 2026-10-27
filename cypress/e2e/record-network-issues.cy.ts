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

  // ADHOC: flaky on CI with Cypress 15 (about 1 in 40 runs): the proxy reports ENOTFOUND, yet the plugin
  // never receives `Network.requestWillBeSent` for the request, so the HAR has no entry. Not reproduced
  // in 40 probe runs, so the cause is unknown.
  // For details please refer to https://github.com/BrightSec/cypress-har-generator/actions/runs/40182047739/attempts/1
  it.skip('records a request failed due DNS issues', () => {
    cy.visit('/');
    cy.recordHar();

    cy.window().then(win => win.fetch(url).catch(() => undefined));
  });
});

describe('Record failed requests', () => {
  it('records why a request failed', () => {
    cy.intercept('/api/products', { forceNetworkError: true });
    cy.visit('/');
    cy.recordHar();

    cy.window().then(win => win.fetch('/api/products').catch(() => undefined));

    cy.saveHar({ waitForIdle: true });

    // ADHOC: the Cypress proxy destroys the socket of a request stubbed with `forceNetworkError`,
    // so Chrome reports it as an empty response
    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: { url: /\/api\/products$/ },
        response: { status: 0, _error: 'net::ERR_EMPTY_RESPONSE' }
      });
  });
});
