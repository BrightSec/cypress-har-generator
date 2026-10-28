import { Entry } from 'har-format';

type Test = { titlePath: string[]; attempt: number };

const path = (url: string): string => new URL(url).pathname;

// the test that sent each request of the app, leaving out the ones of the Cypress runner
const testsOf = (entries: Entry[]): [string, Test | undefined][] =>
  entries
    .filter(({ request }) => /^\/(pages|api)\//.test(path(request.url)))
    .map(entry => [path(entry.request.url), entry._test as Test | undefined]);

describe('Tests', () => {
  describe('recorded across the tests of a suite', () => {
    const fileName = 'tests.cy.har';

    before(() => {
      cy.tmpdir().then(outDir => cy.remove(`${outDir}/${fileName}`));
      cy.visit('/');
      cy.recordHar();
      // Cypress runs the `before` hooks within the first test, which it reports their failures under
      cy.window().then(win =>
        win.fetch('/api/delay/1').then(res => res.text())
      );
    });

    it('sends a request from the first test', () => {
      cy.visit('/pages/fetch');
      cy.get('ul > li').should('have.length.gte', 1);
    });

    it(
      'sends a request from each try of a retried test',
      { retries: 1 },
      () => {
        cy.window().then(win =>
          win
            .fetch(`/api/delay/${10 + Cypress.currentRetry}`)
            .then(res => res.text())
        );
        cy.then(() => expect(Cypress.currentRetry).to.equal(1));
      }
    );

    it('marks each request with the test and the try that sent it', () => {
      cy.tmpdir().then(outDir => cy.saveHar({ outDir, fileName }));

      cy.tmpdir()
        .then(outDir => cy.readFile(`${outDir}/${fileName}`, 'utf-8'))
        .then((text: string) => {
          const { log }: { log: { entries: Entry[] } } = JSON.parse(text);
          const suite = ['Tests', 'recorded across the tests of a suite'];

          expect(testsOf(log.entries)).to.deep.equal([
            [
              '/api/delay/1',
              {
                titlePath: [...suite, 'sends a request from the first test'],
                attempt: 1
              }
            ],
            [
              '/pages/fetch',
              {
                titlePath: [...suite, 'sends a request from the first test'],
                attempt: 1
              }
            ],
            [
              '/api/products',
              {
                titlePath: [...suite, 'sends a request from the first test'],
                attempt: 1
              }
            ],
            [
              '/api/delay/10',
              {
                titlePath: [
                  ...suite,
                  'sends a request from each try of a retried test'
                ],
                attempt: 1
              }
            ],
            [
              '/api/delay/11',
              {
                titlePath: [
                  ...suite,
                  'sends a request from each try of a retried test'
                ],
                attempt: 2
              }
            ]
          ]);
        });
    });
  });

  it('marks the requests of a recording started within the test', () => {
    cy.visit('/');
    cy.recordHar();

    cy.window().then(win => win.fetch('/api/products').then(res => res.text()));

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should((entries: Entry[]) =>
        expect(testsOf(entries)).to.deep.equal([
          [
            '/api/products',
            {
              titlePath: [
                'Tests',
                'marks the requests of a recording started within the test'
              ],
              attempt: 1
            }
          ]
        ])
      );
  });
});
