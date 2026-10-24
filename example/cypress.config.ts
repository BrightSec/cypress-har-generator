import { defineConfig } from 'cypress';
import { install } from '../src';

export default defineConfig({
  video: false,
  fixturesFolder: false,
  screenshotOnRunFailure: false,
  env: {
    // Set an output directory to change the destination folder
    hars_folder: 'cypress/hars'
  },
  // setupNodeEvents can be defined in either
  // the e2e or component configuration
  e2e: {
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/integration/**/*.cy.ts',
    baseUrl: 'http://localhost:7079',
    setupNodeEvents(on: Cypress.PluginEvents): void {
      // Install the plugin to record a HAR file
      install(on);
    }
  }
});
