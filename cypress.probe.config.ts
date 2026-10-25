import base from './cypress.config';
import { ensureBrowserFlags } from './src';
import { defineConfig } from 'cypress';

export default defineConfig({
  ...base,
  e2e: {
    ...base.e2e,
    specPattern: process.env.SPEC ?? 'cypress/e2e/zz-probe.cy.ts',
    setupNodeEvents(on, config) {
      base.e2e?.setupNodeEvents?.(on, config);
      on('before:browser:launch', (browser, launchOptions) => {
        ensureBrowserFlags(browser, launchOptions);
        if (browser.name !== 'electron') {
          launchOptions.args.push('--no-sandbox');
        }
        return launchOptions;
      });
    }
  }
});
