import { Entry } from 'har-format';

const fetchJson = (url: string, init?: RequestInit) =>
  cy.window().then(win => win.fetch(url, init).then(res => res.json()));

const postSum = (args: number[]) =>
  fetchJson('/api/math', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'sum', args })
  });

describe('Replay HAR', () => {
  const fileName = 'replay-har.cy.har';

  beforeEach(() => {
    cy.visit('/');
    cy.tmpdir().then(outDir => {
      cy.remove(`${outDir}/${fileName}`);
      cy.wrap(`${outDir}/${fileName}`).as('path');
    });
  });

  after(() => cy.tmpdir().then(outDir => cy.remove(`${outDir}/${fileName}`)));

  const record = (actions: () => void) => {
    cy.recordHar();
    actions();
    cy.tmpdir().then(outDir => cy.saveHar({ outDir, fileName }));
  };

  it('serves the recorded response instead of the server one', () => {
    record(() => fetchJson('/api/random').as('recorded'));

    cy.get<string>('@path').then(path => cy.replayHar(path));

    cy.get<{ value: string }>('@recorded').then(recorded =>
      fetchJson('/api/random').should('deep.equal', recorded)
    );
  });

  it('serves the repeated requests in the recorded order, then the last one', () => {
    record(() => {
      fetchJson('/api/random').as('first');
      fetchJson('/api/random').as('second');
    });

    cy.get<string>('@path').then(path => cy.replayHar(path));

    cy.get<{ value: string }>('@first').then(first =>
      fetchJson('/api/random').should('deep.equal', first)
    );
    cy.get<{ value: string }>('@second').then(second => {
      fetchJson('/api/random').should('deep.equal', second);
      fetchJson('/api/random').should('deep.equal', second);
    });
  });

  it('matches a request by its body', () => {
    record(() => {
      postSum([1, 2]);
      postSum([3, 4]);
    });

    cy.get<string>('@path').then(path => cy.replayHar(path));

    postSum([3, 4]).should('equal', 7);
    postSum([1, 2]).should('equal', 3);
  });

  it('fails a request missing from the HAR with a network error', () => {
    record(() => postSum([1, 2]));

    cy.get<string>('@path').then(path => cy.replayHar(path));

    cy.window().then(win =>
      win
        .fetch('/api/products')
        .then(
          () => 'served',
          () => 'failed'
        )
        .then(result => expect(result).to.equal('failed'))
    );
  });

  it('passes a request missing from the HAR on to the server with the fallback', () => {
    record(() => postSum([1, 2]));

    cy.get<string>('@path').then(path =>
      cy.replayHar(path, { notFound: 'fallback' })
    );

    fetchJson('/api/products').its('products').should('have.length', 6);
  });

  it('serves only the requests matching the given URL', () => {
    record(() => fetchJson('/api/random').as('recorded'));

    cy.get<string>('@path').then(path =>
      cy.replayHar(path, { url: '**/api/random' })
    );

    fetchJson('/api/products').its('products').should('have.length', 6);
    cy.get<{ value: string }>('@recorded').then(recorded =>
      fetchJson('/api/random').should('deep.equal', recorded)
    );
  });

  it('serves a binary body recorded in base64', () => {
    const fetchBytes = () =>
      cy.window().then(win =>
        win
          .fetch('/api/random-bytes')
          .then(res => res.arrayBuffer())
          .then(body => Array.from(new Uint8Array(body)))
      );

    record(() => fetchBytes().as('recorded'));

    cy.get<string>('@path').then(path => {
      cy.findHar(path)
        .its('log.entries')
        .should('contain.something.like', {
          request: { url: /\/api\/random-bytes$/ },
          response: { content: { encoding: 'base64' } }
        });
      cy.replayHar(path);
    });

    cy.get<number[]>('@recorded').then(recorded =>
      fetchBytes().should('deep.equal', recorded)
    );
  });

  it('serves the first recorded cookie', () => {
    record(() => fetchJson('/api/cookies'));

    cy.clearCookies();
    cy.get<string>('@path').then(path =>
      cy.replayHar(path, { url: '**/api/cookies' })
    );

    fetchJson('/api/cookies');
    cy.get<string>('@path').then(path =>
      cy
        .findHar(path)
        .its('log.entries')
        .then((entries: Entry[]) =>
          entries.find(({ request }) => request.url.endsWith('/api/cookies'))
        )
        .then(({ response }: Entry) =>
          cy
            .getCookies()
            .then(cookies =>
              cookies.map(({ name, value }) => ({ name, value }))
            )
            .should('deep.equal', [
              {
                name: response.cookies[0].name,
                value: response.cookies[0].value
              }
            ])
        )
    );
  });

  it('serves a visited page with its requests', () => {
    record(() => cy.visit('/pages/post-data'));

    cy.get<string>('@path').then(path => cy.replayHar(path));

    cy.visit('/pages/post-data');
    cy.get('#text').should('contain.text', 'john.doe@example.com');
  });

  it('loads a recorded page from the server, so Cypress injects its runner script once', () => {
    record(() => cy.visit('/pages/fetch'));

    cy.get<string>('@path').then(path => cy.replayHar(path));

    cy.visit('/pages/fetch');
    // the runner script Cypress injects into each page takes the global `Cypress` of the parent window
    cy.document()
      .then(doc =>
        [...doc.scripts].filter(({ text }) => text.includes('parent.Cypress'))
      )
      .should('have.length', 1);
  });

  it('serves a route the server does not have, without recording', () => {
    const url = `${Cypress.config('baseUrl')}/api/unavailable`;

    cy.get<string>('@path').then(path => {
      cy.writeFile(path, {
        log: {
          version: '1.2',
          creator: { name: 'test', version: '1' },
          entries: [
            {
              request: { method: 'GET', url, headers: [] },
              response: {
                status: 201,
                statusText: 'Created',
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                content: {
                  size: 13,
                  mimeType: 'application/json',
                  text: '{"id":"har"}'
                }
              }
            }
          ]
        }
      });
      cy.replayHar(path);
    });

    cy.window()
      .then(win =>
        win.fetch('/api/unavailable').then(async res => ({
          status: res.status,
          body: await res.json()
        }))
      )
      .should('deep.equal', { status: 201, body: { id: 'har' } });
  });
});
