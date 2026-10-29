# Migrating from version 5 to version 6

1. [Before you start](#before-you-start)
2. [Find what applies to you](#find-what-applies-to-you)
3. [Fix what breaks](#fix-what-breaks)
4. [Check your HARs](#check-your-hars)
5. [Choose how to record](#choose-how-to-record)
6. [All breaking changes](#all-breaking-changes)

## Before you start

| Tool       | Version 5 | Version 6            |
| ---------- | --------- | -------------------- |
| Cypress    | 4.4.1+    | 15.10+               |
| Node.js    | no limit  | 20.19+, or 22.12+    |
| TypeScript | 4+        | 5.0+, in TS projects |

If you can't update one of them yet, stay on version 5:

```bash
$ npm i -D @neuralegion/cypress-har-generator@5
```

## Find what applies to you

Run this in your project. Each line it prints points to a step below:

```bash
$ grep -rnE "install\(on\)|enableExperimentalLifecycle|ensureBrowserFlags|minStatusCodeToInclude|hars_folders?|HARS_FOLDERS?|cypress-har-generator/(dist|commands\.js)|content\.error" \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' --include='*.mts' --include='*.cts' \
    --include='*.json' --include='*.yml' --include='*.yaml' --exclude-dir=node_modules .
```

| The line has                                                                  | Step                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `install(on)`, `enableExperimentalLifecycle`                                  | [2](#2-pass-the-config-to-install)                     |
| `hars_folder` under `env`, `--env`, `CYPRESS_`, `hars_folders`, `HARS_FOLDER` | [3](#3-move-hars_folder-to-expose)                     |
| `minStatusCodeToInclude`                                                      | [4](#4-replace-minstatuscodetoinclude)                 |
| `ensureBrowserFlags`                                                          | [5](#5-replace-ensurebrowserflags-with-cypress-on-fix) |
| `cypress-har-generator/dist`, `commands.js`                                   | [6](#6-import-only-the-package-and-its-commands)       |
| `content.error`                                                               | [7](#7-read-content_error-instead-of-contenterror)     |

## Fix what breaks

### 1. Update Cypress, Node.js and TypeScript

You need this if your versions are older than the ones in [Before you start](#before-you-start).

```bash
$ npm i -D cypress@latest @neuralegion/cypress-har-generator@latest
```

### 2. Pass the config to `install`

You need this if your config calls `install(on)` or `enableExperimentalLifecycle`, or you see:

> TypeError: \`install\` requires the config: call \`install(on, config)\` in \`setupNodeEvents(on, config)\`.

```diff
 setupNodeEvents(on, config) {
-  install(on);
-  enableExperimentalLifecycle(on, config);
+  install(on, config);
 }
```

`install(on, config, { lifecycle: true })` is now the default, so drop the option. `install` now also records a HAR for each spec: see [Choose how to record](#choose-how-to-record).

### 3. Move `hars_folder` to `expose`

You need this if you set `hars_folder` in `env`, with `--env` or with `CYPRESS_hars_folder`, or use the `hars_folders` or `HARS_FOLDER` names. Version 6 ignores them all, so the HARs land in the project root.

```diff
 export default defineConfig({
-  env: { hars_folder: 'cypress/hars' },
+  expose: { hars_folder: 'cypress/hars' },
```

```diff
-$ cypress run --env hars_folder=cypress/hars
+$ cypress run --expose hars_folder=cypress/hars
```

### 4. Replace `minStatusCodeToInclude`

You need this if you pass `minStatusCodeToInclude`. JavaScript ignores it now, and TypeScript fails with:

> error TS2353: Object literal may only specify known properties, and 'minStatusCodeToInclude' does not exist in type 'InstallOptions'.

`minStatusCodeToInclude: 400` recorded only the codes from 400 up. List the lower codes your app returns in `excludeStatusCodes` instead:

```diff
-cy.recordHar({ minStatusCodeToInclude: 400 });
+cy.recordHar({ excludeStatusCodes: [200, 201, 204, 301, 302, 304] });
```

### 5. Replace `ensureBrowserFlags` with `cypress-on-fix`

You need this if you call `ensureBrowserFlags`, or you see one of:

> SyntaxError: The requested module '@neuralegion/cypress-har-generator' does not provide an export named 'ensureBrowserFlags'

> TypeError: ensureBrowserFlags is not a function

> The plugin's 'before:browser:launch' listener did not run, so the browser was started without a debugging port.

Cypress keeps only the last listener for each event in `setupNodeEvents`, so your own `before:browser:launch`, `before:spec` or `after:spec` listener replaces the plugin's. Wrap `on` with [cypress-on-fix](https://github.com/bahmutov/cypress-on-fix), which keeps every listener:

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

### 6. Import only the package and its commands

You need this if you import a file inside the package, or you see:

> Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist/index.js' is not defined by "exports"

```diff
-import { install } from '@neuralegion/cypress-har-generator/dist/index.js';
+import { install } from '@neuralegion/cypress-har-generator';
```

```diff
-import '@neuralegion/cypress-har-generator/commands.js';
+import '@neuralegion/cypress-har-generator/commands';
```

### 7. Read `content._error` instead of `content.error`

You need this if your code reads why a response body is missing. HAR 1.2 allows extra fields only when their names start with `_`, so strict HAR tools dropped `content.error`.

```diff
-const reason = entry.response.content.error;
+const reason = entry.response.content._error;
```

## Check your HARs

These change the HAR with no error.

| What                                                    | Version 5                    | Version 6                          | To get version 5 back |
| ------------------------------------------------------- | ---------------------------- | ---------------------------------- | --------------------- |
| A HAR for each spec                                     | off                          | on                                 | `lifecycle: false`    |
| Saving waits for the pending requests                   | no                           | yes, up to `maxWaitDuration` (5 s) | `waitForIdle: false`  |
| Requests of Cypress itself, under `/__/`, `/__cypress/` | recorded                     | left out                           | `excludePaths: []`    |
| `blob:` requests                                        | recorded                     | left out                           | `includeBlobs: true`  |
| HAR name of `cypress/e2e/admin/login.cy.ts`             | `{hars_folder}/login.cy.har` | `{hars_folder}/admin/login.cy.har` | none                  |

Passing `excludePaths` replaces its default. To leave out your own paths and the requests of Cypress, list both:

```js
cy.recordHar({ excludePaths: [/^\/__(cypress[\w-]*)?\//, /^\/login/] });
```

## Choose how to record

| You want                                            | Set                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| a HAR of each spec, saved even if a run stops early | `install(on, config)`, and remove `cy.recordHar()` and `cy.saveHar()` from your tests     |
| a HAR only of the specs where a test failed         | `install(on, config, { failedTestsOnly: true })`                                          |
| to record only some steps, as in version 5          | `install(on, config, { lifecycle: false })`, and keep `cy.recordHar()` and `cy.saveHar()` |

The HAR of each spec takes the options of `cy.recordHar()` and `cy.saveHar()`, so the options in your tests can move to `install`.

## All breaking changes

- Cypress 15.10 or later is required ([#620](https://github.com/BrightSec/cypress-har-generator/pull/620), [#633](https://github.com/BrightSec/cypress-har-generator/pull/633))
- Node.js 20.19 or later, or 22.12 or later, is required ([#619](https://github.com/BrightSec/cypress-har-generator/pull/619))
- TypeScript 5.0 or later is required ([#621](https://github.com/BrightSec/cypress-har-generator/pull/621))
- Only the package and its commands can be imported ([#622](https://github.com/BrightSec/cypress-har-generator/pull/622))
- A HAR is recorded for each spec by default, and `install` requires the config ([#623](https://github.com/BrightSec/cypress-har-generator/pull/623))
- The requests of Cypress itself are left out by default ([#624](https://github.com/BrightSec/cypress-har-generator/pull/624))
- `minStatusCodeToInclude` and `hars_folders` are removed, and `blob:` requests are left out by default ([#630](https://github.com/BrightSec/cypress-har-generator/pull/630))
- `hars_folder` is read only from `expose` ([#633](https://github.com/BrightSec/cypress-har-generator/pull/633))
- The HAR of each spec keeps the folder of the spec in its name ([#645](https://github.com/BrightSec/cypress-har-generator/pull/645))
- `ensureBrowserFlags` is removed ([#646](https://github.com/BrightSec/cypress-har-generator/pull/646))
- Saving waits for the network to be idle by default ([#647](https://github.com/BrightSec/cypress-har-generator/pull/647))
- The reason a response body is missing is in `content._error` ([#648](https://github.com/BrightSec/cypress-har-generator/pull/648))

Something worked in version 5 and doesn't in version 6? [Open a bug](https://github.com/BrightSec/cypress-har-generator/issues/new?template=bug_report.md), or ask on the [version 6 issue](https://github.com/BrightSec/cypress-har-generator/issues/667).
