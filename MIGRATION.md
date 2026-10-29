# Migrating from version 5 to version 6

Go through the checklist, then read the sections of the items that apply to you.

- [ ] [Update Cypress, Node.js and TypeScript](#requirements)
- [ ] [Pass the config to `install`, and choose how to record](#a-har-for-each-spec-by-default)
- [ ] [Move `hars_folder` to `expose`](#hars_folder-is-read-only-from-expose)
- [ ] [Replace the removed options and functions](#removed-options-and-functions)
- [ ] [Check the new defaults](#new-defaults)
- [ ] [Import only the package and its commands](#only-the-public-entry-points-can-be-imported)
- [ ] [Read `content._error` instead of `content.error`](#contenterror-is-now-content_error)

## Requirements

| Tool       | Version 5 | Version 6            |
| ---------- | --------- | -------------------- |
| Cypress    | 4.4.1+    | 15.10+               |
| Node.js    | no limit  | 20.19+, or 22.12+    |
| TypeScript | 4+        | 5.0+, in TS projects |

If you can't update one of them yet, stay on version 5:

```bash
$ npm i -D @neuralegion/cypress-har-generator@5
```

## A HAR for each spec by default

`install` now needs the config, and records a HAR for each spec with no change to your tests. Without the config, it throws a `TypeError`.

```diff
 setupNodeEvents(on, config) {
-  install(on);
+  install(on, config);
 }
```

If you used the HAR of each spec in version 5, drop the options that turned it on:

```diff
-enableExperimentalLifecycle(on, config);
-install(on, config, { lifecycle: true });
+install(on, config);
```

If your tests call `cy.recordHar()` and `cy.saveHar()` themselves, choose one:

- Remove the calls, and use the HAR of each spec. It is saved even when a run stops early, such as with `Cypress.stop()`.
- Keep the calls, and turn the HAR of each spec off:

  ```js
  install(on, config, { lifecycle: false });
  ```

The HAR of each spec takes the same options as `cy.recordHar()` and `cy.saveHar()`, so options passed in your tests can move to `install`. To keep only the HARs of the failed tests, which version 5 needed an `afterEach` hook for, pass `failedTestsOnly: true`.

## `hars_folder` is read only from `expose`

Version 6 reads the folder with `Cypress.expose()`, which replaces the deprecated `Cypress.env()`.

```diff
 export default defineConfig({
-  env: { hars_folder: 'cypress/hars' },
+  expose: { hars_folder: 'cypress/hars' },
```

```diff
-$ cypress run --env hars_folder=cypress/hars
+$ cypress run --expose hars_folder=cypress/hars
```

The `CYPRESS_hars_folder` environment variable, and the `HARS_FOLDER` and `hars_folders` names, are no longer read.

## Removed options and functions

| Version 5                     | Version 6                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `minStatusCodeToInclude`      | `excludeStatusCodes`, which lists the codes to leave out                                                 |
| `enableExperimentalLifecycle` | `install(on, config)`                                                                                    |
| `ensureBrowserFlags`          | nothing: `install` adds the browser flags. To keep your own `before:browser:launch` listener, see below. |

`minStatusCodeToInclude: 400` recorded only the codes from 400 up. List the lower codes your app returns instead:

```js
cy.recordHar({ excludeStatusCodes: [200, 201, 204, 301, 302, 304] });
```

Cypress keeps only the last listener for each event in `setupNodeEvents`, so a listener of your own for `before:browser:launch`, `before:spec` or `after:spec` replaces the plugin's. `ensureBrowserFlags` worked around this for `before:browser:launch` only. Wrap `on` with [cypress-on-fix](https://github.com/bahmutov/cypress-on-fix) instead, which keeps every listener:

```diff
+import onFix from 'cypress-on-fix';

-setupNodeEvents(on, config) {
+setupNodeEvents(cypressOn, config) {
+  const on = onFix(cypressOn);
   install(on, config);
   on('before:browser:launch', (browser, launchOptions) => {
-    ensureBrowserFlags(browser, launchOptions);
     return launchOptions;
   });
 }
```

## New defaults

These change the HAR with no change to your code.

| What                                                    | Version 5                    | Version 6                          | To get version 5 back                                               |
| ------------------------------------------------------- | ---------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| A HAR for each spec                                     | off                          | on                                 | `install(on, config, { lifecycle: false })`                         |
| Saving waits for the pending requests                   | no                           | yes, up to `maxWaitDuration` (5 s) | `waitForIdle: false`                                                |
| Requests of Cypress itself, under `/__/`, `/__cypress/` | recorded                     | left out                           | `excludePaths: []`                                                  |
| `blob:` requests                                        | recorded                     | left out                           | `includeBlobs: true`                                                |
| Name of the HAR of `cypress/e2e/admin/login.cy.ts`      | `{hars_folder}/login.cy.har` | `{hars_folder}/admin/login.cy.har` | none: specs with the same name no longer overwrite each other's HAR |

Passing `excludePaths` replaces its default. To leave out your own paths and the requests of Cypress, list both:

```js
cy.recordHar({ excludePaths: [/^\/__(cypress[\w-]*)?\//, /^\/login/] });
```

## Only the public entry points can be imported

Deep imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import the package or its commands:

```diff
-import { install } from '@neuralegion/cypress-har-generator/dist/index.js';
+import { install } from '@neuralegion/cypress-har-generator';
```

```diff
-import '@neuralegion/cypress-har-generator/commands.js';
+import '@neuralegion/cypress-har-generator/commands';
```

## `content.error` is now `content._error`

When the plugin can't read a response body, the reason is now in `response.content._error`. HAR 1.2 allows extra fields only when their names start with `_`, so strict HAR tools dropped `content.error`. Update code that reads it:

```diff
-const reason = entry.response.content.error;
+const reason = entry.response.content._error;
```

## Help

Ask on the [version 6 issue](https://github.com/BrightSec/cypress-har-generator/issues/667), or [open a bug](https://github.com/BrightSec/cypress-har-generator/issues/new?template=bug_report.md) if something worked in version 5 and doesn't in version 6.
