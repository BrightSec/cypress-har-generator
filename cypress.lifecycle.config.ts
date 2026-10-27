import base from './cypress.config.ts';
import { install } from './src/index.ts';
import { defineConfig } from 'cypress';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

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

      on('before:run', async () => {
        await Promise.all(
          harPaths.map(({ path }) => rm(path, { force: true }))
        );
      });
      // `Cypress.stop()` skips the rest of the run, so the HAR can only be checked once the run is over
      on('after:run', async () => {
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
        }
      });
    }
  }
});
