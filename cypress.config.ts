import { install } from './src/index.ts';
import { defineConfig } from 'cypress';
import { access, constants, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// `expose` exists since Cypress 15.10 and `env` is what earlier versions read, so the e2e suite can run on both
const { version } = createRequire(join(process.cwd(), 'package.json'))(
  'cypress/package.json'
) as { version: string };
const [major, minor]: number[] = version.split('.').map(Number);
const variables = { hars_folder: 'cypress/hars' };
const exposeSupported = major > 15 || (major === 15 && minor >= 10);

export default defineConfig({
  projectId: 'ir8zwo',
  video: false,
  fixturesFolder: false,
  screenshotOnRunFailure: false,
  trashAssetsBeforeRuns: true,
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    ...(exposeSupported ? { expose: variables } : { env: variables }),
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): void {
      install(on, config, { lifecycle: false });

      on('task', {
        async 'fs:match'({
          path,
          regexp
        }: {
          path: string;
          regexp: RegExp;
        }): Promise<boolean> {
          try {
            const result = await readFile(path, 'utf-8');

            return new RegExp(regexp).test(result);
          } catch {
            return false;
          }
        },
        async 'fs:exists'(path: string): Promise<boolean> {
          try {
            await access(path, constants.F_OK);

            return true;
          } catch {
            return false;
          }
        },
        async 'fs:remove'(path: string): Promise<null> {
          try {
            await unlink(path);
          } catch {
            // noop
          }

          return null;
        },
        'fs:tmpdir'(): string {
          return tmpdir();
        }
      });
    }
  }
});
