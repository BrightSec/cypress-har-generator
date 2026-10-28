import base from './cypress.config.ts';
import { install } from './src/index.ts';
import { defineConfig } from 'cypress';
import { access, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const retriedHar = join('cypress', 'hars', 'retried.cy.har');
const passedHar = join('cypress', 'hars', 'passed.cy.har');

interface Log {
  pages: { id: string; title: string }[];
  _tests?: { id: string; titlePath: string[]; attempt: number }[];
  entries: { pageref?: string; _testref?: string; request: { url: string } }[];
}

export default defineConfig({
  ...base,
  e2e: {
    ...base.e2e,
    specPattern: 'cypress/failed-tests/**/*.cy.ts',
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): void {
      install(on, config, { failedTestsOnly: true });

      on('before:run', async () => {
        await Promise.all(
          [retriedHar, passedHar].map(path => rm(path, { force: true }))
        );
      });
      on('after:run', async () => {
        const passed: boolean = await access(passedHar).then(
          () => true,
          () => false
        );

        if (passed) {
          throw new Error(`${passedHar} was written, though no test failed`);
        }

        const { log }: { log: Log } = JSON.parse(
          await readFile(retriedHar, 'utf-8')
        );
        const urls: string[] = log.entries.map(({ request }) =>
          request.url.replace(config.baseUrl ?? '', '')
        );
        const expected = ['/', '/api/products?attempt=1'];

        if (JSON.stringify(urls) !== JSON.stringify(expected)) {
          throw new Error(
            `${retriedHar} has ${urls.join(', ')}, not ${expected.join(', ')}`
          );
        }

        const tests: string = JSON.stringify(
          log._tests?.map(({ id, titlePath, attempt }) => ({
            id,
            titlePath,
            attempt
          }))
        );
        const expectedTests: string = JSON.stringify([
          {
            id: 'test_1',
            titlePath: ['Failed tests only', 'passes on the second try'],
            attempt: 1
          }
        ]);

        if (tests !== expectedTests) {
          throw new Error(`${retriedHar} has the tests ${tests}`);
        }

        // the first test and the second try loaded pages too, which are left out with their entries
        const pages: string[] = log.pages.map(({ id }) => id);
        const refs: string[] = log.entries.map(
          ({ pageref, _testref }) => `${pageref}/${_testref}`
        );

        if (
          JSON.stringify(pages) !== JSON.stringify(['page_1']) ||
          refs.some(x => x !== 'page_1/test_1')
        ) {
          throw new Error(
            `${retriedHar} has the pages ${pages.join(', ')} and refs ${refs.join(', ')}`
          );
        }
      });
    }
  }
});
