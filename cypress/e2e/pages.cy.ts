import { Entry, Page } from 'har-format';

type Log = { pages: Page[]; entries: Entry[] };

const path = (url: string): string => new URL(url).pathname;

// the requests of the app, leaving out the ones of the Cypress runner
const appEntries = ({ entries }: Log): [string | undefined, string][] =>
  entries
    .filter(({ request }) =>
      /^\/(pages|api|redirect)\b/.test(path(request.url))
    )
    .map(({ pageref, request }) => [pageref, path(request.url)]);

describe('Pages', () => {
  beforeEach(() => cy.visit('/'));

  it('records a page for a document loaded by a link, titled with its URL and with no timings', () => {
    cy.recordHar();

    cy.get('a[href$=fetch]').click();
    cy.get('ul > li').should('have.length.gte', 1);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        expect(log.pages).to.have.length(1);
        expect(log.pages[0]).to.deep.include({
          id: 'page_1',
          title: `${Cypress.config('baseUrl')}/pages/fetch`,
          pageTimings: {}
        });
        expect(new Date(log.pages[0].startedDateTime).toISOString()).to.equal(
          log.pages[0].startedDateTime
        );
        expect(appEntries(log)).to.deep.equal([
          ['page_1', '/pages/fetch'],
          ['page_1', '/api/products']
        ]);
      });
  });

  it('records a page for each document of the app, holding the requests of its iframes', () => {
    cy.recordHar();

    cy.visit('/pages/fetch');
    cy.get('ul > li').should('have.length.gte', 1);
    cy.visit('/pages/nested-frame');
    cy.get('iframe')
      .its('0.contentDocument.body')
      .find('ul > li')
      .should('have.length.gte', 1);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        expect(
          log.pages.map(({ id, title }) => [id, path(title)])
        ).to.deep.equal([
          ['page_1', '/pages/fetch'],
          ['page_2', '/pages/nested-frame']
        ]);
        expect(appEntries(log)).to.deep.equal([
          ['page_1', '/pages/fetch'],
          ['page_1', '/api/products'],
          ['page_2', '/pages/nested-frame'],
          ['page_2', '/pages/fetch'],
          ['page_2', '/api/products']
        ]);
      });
  });

  it('records one page for a redirected document, titled with the URL it was redirected to', () => {
    cy.recordHar();

    // `cy.visit()` follows the redirects itself before loading the page, so the browser is sent to the redirect instead
    cy.window().then(win => win.location.assign('/redirect'));
    cy.location('pathname').should('equal', '/pages/fetch');
    cy.get('ul > li').should('have.length.gte', 1);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        expect(log.pages.map(({ title }) => path(title))).to.deep.equal([
          '/pages/fetch'
        ]);
        expect(appEntries(log)).to.deep.equal([
          ['page_1', '/redirect'],
          ['page_1', '/pages/fetch'],
          ['page_1', '/api/products']
        ]);
      });
  });

  it('leaves out the page of a request sent by a document loaded before recording', () => {
    cy.visit('/pages/fetch');
    cy.get('ul > li').should('have.length.gte', 1);

    cy.recordHar();
    cy.window().then(win => win.fetch('/api/products').then(res => res.text()));

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        expect(log.pages).to.deep.equal([]);
        expect(appEntries(log)).to.deep.equal([[undefined, '/api/products']]);
      });
  });

  it('leaves out the page of a document left out by the options', () => {
    cy.recordHar({ excludePaths: [/^\/pages\/fetch$/] });

    cy.visit('/pages/fetch');
    cy.get('ul > li').should('have.length.gte', 1);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        expect(log.pages).to.deep.equal([]);
        expect(appEntries(log)).to.deep.equal([[undefined, '/api/products']]);
      });
  });

  it('starts the pages at the epoch with stable', () => {
    cy.recordHar({ stable: true });

    cy.visit('/pages/fetch');
    cy.get('ul > li').should('have.length.gte', 1);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.pages')
      .should((pages: Page[]) =>
        expect(
          pages.map(({ startedDateTime }) => startedDateTime)
        ).to.deep.equal(['1970-01-01T00:00:00.000Z'])
      );
  });

  it('records the pages of a popup apart from the ones of its opener', () => {
    cy.recordHar();

    cy.get('a[href$=multi-targets]').click();
    cy.window().then(win => cy.spy(win, 'open').as('open'));
    cy.get('#popup-window').click();
    cy.get<sinon.SinonSpy>('@open')
      .its('returnValues.0')
      .should((popup: Window) =>
        expect(popup.document.readyState).to.eq('complete')
      );

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log')
      .should((log: Log) => {
        const pageOf = (pathname: string) =>
          log.pages.find(({ title }) => path(title) === pathname)?.id;

        expect(log.pages.map(({ title }) => path(title))).to.have.members([
          '/pages/multi-targets',
          '/pages/popup'
        ]);
        expect(pageOf('/pages/popup')).not.to.equal(
          pageOf('/pages/multi-targets')
        );
        expect(
          log.entries.find(
            ({ request }) => path(request.url) === '/pages/popup'
          )?.pageref
        ).to.equal(pageOf('/pages/popup'));
      });
  });
});
