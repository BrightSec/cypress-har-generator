import base from './cypress.config.ts';
import { install } from './src/index.ts';
import { defineConfig } from 'cypress';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// the two specs share a name, so each HAR must keep the folder of its spec
const harPaths = [
  {
    path: join('cypress', 'hars', 'stop.cy.har'),
    // `/api/delay/3500` is still in flight when the spec ends, so the HAR has it only if saving waits for idle
    urls: ['/', '/api/delay/3500']
  },
  {
    path: join('cypress', 'hars', 'nested', 'stop.cy.har'),
    urls: ['/pages/fetch']
  },
  // `cy.replayHar()` finds no HAR for the spec, so the spec records it
  {
    path: join('cypress', 'hars', 'record.cy.har'),
    urls: ['/', '/api/random']
  }
];

// `cy.replayHar()` in these specs serves their HARs, which must not be overwritten with the replayed responses
interface ReplayedHar {
  path: string;
  tests?: { id: string; titlePath: string[]; attempt: number }[];
  entries: { value: string; testref?: string }[];
}

const replayedHars: ReplayedHar[] = [
  {
    path: join('cypress', 'hars', 'replay.cy.har'),
    entries: [{ value: 'first' }, { value: 'second' }]
  },
  // listed in another order than the spec runs its tests, with a failed try of the first test
  {
    path: join('cypress', 'hars', 'replay-tests.cy.har'),
    tests: [
      { id: 'test_1', titlePath: ['Replay each test', 'second'], attempt: 1 },
      { id: 'test_2', titlePath: ['Replay each test', 'first'], attempt: 1 },
      { id: 'test_3', titlePath: ['Replay each test', 'first'], attempt: 2 }
    ],
    entries: [
      { value: 'second', testref: 'test_1' },
      { value: 'failed try', testref: 'test_2' },
      { value: 'first', testref: 'test_3' }
    ]
  }
];

export default defineConfig({
  ...base,
  e2e: {
    ...base.e2e,
    specPattern: 'cypress/lifecycle/**/*.cy.ts',
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): void {
      install(on, config);

      const replayedHar = (
        baseUrl: string,
        { tests, entries }: ReplayedHar
      ) => ({
        log: {
          version: '1.2',
          creator: { name: 'test', version: '1' },
          ...(tests ? { _tests: tests } : {}),
          entries: entries.map(({ value, testref }) => ({
            ...(testref ? { _testref: testref } : {}),
            request: {
              method: 'GET',
              url: `${baseUrl}/api/random`,
              headers: []
            },
            response: {
              status: 200,
              statusText: 'OK',
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 0,
                mimeType: 'application/json',
                text: JSON.stringify({ value })
              }
            }
          }))
        }
      });

      const assertNotOverwritten = async (
        replayed: ReplayedHar
      ): Promise<void> => {
        const content: string = await readFile(replayed.path, 'utf-8');

        if (
          content !==
          JSON.stringify(replayedHar(config.baseUrl ?? '', replayed))
        ) {
          throw new Error(`${replayed.path} was overwritten`);
        }
      };

      on('before:run', async () => {
        await Promise.all(
          harPaths.map(({ path }) => rm(path, { force: true }))
        );
        for (const replayed of replayedHars) {
          await mkdir(dirname(replayed.path), { recursive: true });
          await writeFile(
            replayed.path,
            JSON.stringify(replayedHar(config.baseUrl ?? '', replayed))
          );
        }
      });
      // `Cypress.stop()` skips the rest of the run, so the HAR can only be checked once the run is over
      on('after:run', async () => {
        await Promise.all(replayedHars.map(assertNotOverwritten));

        for (const { path, urls: expected } of harPaths) {
          const { log } = JSON.parse(await readFile(path, 'utf-8'));
          const urls: string[] = log.entries.map(
            ({ request }: { request: { url: string } }) => request.url
          );

          const missing: string[] = expected.filter(
            url => !urls.includes(`${config.baseUrl}${url}`)
          );

          if (missing.length) {
            throw new Error(`${path} has no entry for ${missing.join(', ')}`);
          }

          // the runner loads its own scripts, such as `/__cypress-cy-prompt/`, when a spec starts
          const internal: string[] = urls.filter(x =>
            /^\/__(cypress[\w-]*)?\//.test(new URL(x).pathname)
          );

          if (internal.length) {
            throw new Error(
              `${path} has Cypress internal requests: ${internal.join(', ')}`
            );
          }

          // each request was sent by a test, as the recording starts before the spec does
          const tests = new Set<string>(
            (log._tests ?? []).map(({ id }: { id: string }) => id)
          );
          const untested: string[] = log.entries
            .filter(
              ({ _testref }: { _testref?: string }) =>
                !_testref || !tests.has(_testref)
            )
            .map(({ request }: { request: { url: string } }) => request.url);

          if (untested.length) {
            throw new Error(
              `${path} has entries with no test: ${untested.join(', ')}`
            );
          }

          // Cypress reports how each try ended in `after:spec`, before the HAR is saved
          const stateless: string[] = (log._tests ?? [])
            .filter(
              ({ state }: { state?: string }) =>
                !['passed', 'failed'].includes(state ?? '')
            )
            .map(({ id }: { id: string }) => id);

          if (stateless.length) {
            throw new Error(
              `${path} has tests with no state: ${stateless.join(', ')}`
            );
          }

          // the first URL is the document of the spec's page, which every request of the spec was sent from
          const pages: string[] = log.pages.map(
            ({ title }: { title: string }) => title
          );
          const outside: string[] = log.entries
            .filter(({ pageref }: { pageref?: string }) => pageref !== 'page_1')
            .map(({ request }: { request: { url: string } }) => request.url);

          if (
            pages[0] !== `${config.baseUrl}${expected[0]}` ||
            outside.length
          ) {
            throw new Error(
              `${path} has the pages ${pages.join(', ')} and entries outside the first one: ${outside.join(', ')}`
            );
          }
        }
      });
    }
  }
});
