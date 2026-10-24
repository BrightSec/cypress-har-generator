import base from './cypress.config';
import { enableExperimentalLifecycle } from './src';
import { defineConfig } from 'cypress';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const harPath = join('cypress', 'hars', 'stop.cy.har');

export default defineConfig({
  ...base,
  e2e: {
    ...base.e2e,
    specPattern: 'cypress/lifecycle/**/*.cy.ts',
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): void {
      base.e2e?.setupNodeEvents?.(on, config);
      enableExperimentalLifecycle(on, config);

      on('before:run', () => rm(harPath, { force: true }));
      // `Cypress.stop()` skips the rest of the run, so the HAR can only be checked once the run is over
      on('after:run', async () => {
        const { log } = JSON.parse(await readFile(harPath, 'utf-8'));
        const urls: string[] = log.entries.map(
          ({ request }: { request: { url: string } }) => request.url
        );

        if (!urls.includes(`${config.baseUrl}/`)) {
          throw new Error(`${harPath} has no entry for ${config.baseUrl}/`);
        }
      });
    }
  }
});
