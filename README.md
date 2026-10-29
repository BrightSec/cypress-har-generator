# cypress-har-generator

[![Maintainability](https://qlty.sh/gh/BrightSec/projects/cypress-har-generator/maintainability.svg)](https://qlty.sh/gh/BrightSec/projects/cypress-har-generator)
[![Test Coverage](https://qlty.sh/gh/BrightSec/projects/cypress-har-generator/coverage.svg)](https://qlty.sh/gh/BrightSec/projects/cypress-har-generator)
[![Build Status](https://github.com/BrightSec/cypress-har-generator/actions/workflows/coverage.yml/badge.svg?branch=master&event=push)](https://github.com/BrightSec/cypress-har-generator/actions/workflows/coverage.yml?query=branch%3Amaster+event%3Apush)
[![NPM Downloads](https://img.shields.io/npm/dw/@neuralegion/cypress-har-generator?label=NPM%20Downloads)](https://www.npmjs.com/package/@neuralegion/cypress-har-generator)
[![cypress-har-generator](https://img.shields.io/endpoint?url=https://cloud.cypress.io/badge/detailed/ir8zwo/master&style=flat&logo=cypress)](https://cloud.cypress.io/projects/ir8zwo/runs)

The Cypress plugin for generating [HTTP Archive (HAR)](http://www.softwareishard.com/blog/har-12-spec/) files is a tool that allows developers and QA engineers to capture detailed information about network requests made during the execution of Cypress tests.

**Advantages**:

- Detailed visibility into network requests including **WebSocket** frames, **Server-Sent Events (SSE)**, and more.
- Ability to replay network requests in a web development tool.
- Easy integration with [**Cypress**](https://www.cypress.io/)

**Why it is important**

- Improves the performance and stability of your application
- Quickly troubleshoot issues with network requests
- Saves a significant amount of time and effort in debugging and troubleshooting network issues.

The plugin allows you to record network requests from multiple targets such as pages, workers, and pop-ups, which allows you to get a more comprehensive view of your application's network activity. This is especially useful for debugging and troubleshooting issues that may be related to multiple sources.

## Table of contents

- [Install](#install)
- [Setting Up the Plugin](#setting-up-the-plugin)
  - [Installing the plugin](#installing-the-plugin)
  - [Registering the commands](#registering-the-commands)
- [Generating a HAR File](#generating-a-har-file)
- [Commands](#commands)
  - [recordHar](#recordhar)
  - [saveHar](#savehar)
  - [disposeOfHar](#disposeofhar)
  - [replayHar](#replayhar)
- [Example Usage](#example-usage)
- [License](#license)

## Install

To install the plugin as development dependency, run the following command:

```bash
$ npm i --save-dev @neuralegion/cypress-har-generator
```

The plugin requires:

- Cypress 15.10.0 or later
- TypeScript 5.0 or later, in TypeScript projects

If your project uses older versions, stay on version 5 of the plugin.

> [!NOTE]
> For details about changes between versions, and information about updates on previous releases, see the Releases tab on GitHub: https://github.com/BrightSec/cypress-har-generator/releases

## Setting Up the Plugin

Setting up the plugin takes two steps: installing it in the Cypress config, and registering its commands in the support file. Both are required: without the second step, Cypress fails with `cy.recordHar is not a function` or `cy.saveHar is not a function`.

### Installing the plugin

Update your `cypress.config.js` file as follows:

```js
import { defineConfig } from 'cypress';
import { install } from '@neuralegion/cypress-har-generator';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      install(on, config);
    }
  }
});
```

> [!TIP]
> The plugin ships both ES modules and CommonJS, so a CommonJS config can load it with `require('@neuralegion/cypress-har-generator')` instead.

> [!NOTE]
> `setupNodeEvents` can be defined in either the e2e or component configuration

> [!WARNING]
> Cypress keeps only the last listener for each event in `setupNodeEvents` ([cypress#5240](https://github.com/cypress-io/cypress/issues/5240)). The plugin listens to `before:browser:launch`, `before:spec` and `after:spec`, so your own listener for one of them replaces the plugin's, or the other way around. Wrap `on` with [cypress-on-fix](https://github.com/bahmutov/cypress-on-fix) to keep them all, as described in [this post](https://glebbahmutov.com/blog/fix-for-cypress-plugin-events/):
>
> ```js
> import { defineConfig } from 'cypress';
> import { install } from '@neuralegion/cypress-har-generator';
> import onFix from 'cypress-on-fix';
>
> export default defineConfig({
>   e2e: {
>     setupNodeEvents(cypressOn, config) {
>       const on = onFix(cypressOn);
>       install(on, config);
>       on('before:browser:launch', (browser, launchOptions) => {
>         // your own changes
>         return launchOptions;
>       });
>     }
>   }
> });
> ```

### Registering the commands

Add the following line to your [support file](https://docs.cypress.io/app/core-concepts/writing-and-organizing-tests#Support-file), which is `cypress/support/e2e.js` by default (`cypress/support/e2e.ts` for TypeScript projects):

```js
import '@neuralegion/cypress-har-generator/commands';
```

> [!IMPORTANT]
> Make sure the line is in the file that Cypress actually loads, which is the one set by the `supportFile` option. With CommonJS, use `require('@neuralegion/cypress-har-generator/commands');` instead.

The import also adds the types of the commands, so TypeScript knows `cy.recordHar`, `cy.saveHar` and `cy.disposeOfHar` without any further configuration.

## Generating a HAR File

Once installed, the plugin records a HAR file for each spec and saves it when the spec ends, with no changes to your test files. The HAR is saved even when a run is stopped early, for example by `Cypress.stop()` or a plugin such as [cypress-fail-fast](https://github.com/javierbrea/cypress-fail-fast).

Each HAR is named after its spec and keeps the spec's folder below the fixed start of `specPattern`, so specs with the same name in different folders get their own files. For example, with `specPattern: 'cypress/e2e/**/*.cy.ts'`:

| Spec                            | HAR                                |
| ------------------------------- | ---------------------------------- |
| `cypress/e2e/login.cy.ts`       | `{hars_folder}/login.cy.har`       |
| `cypress/e2e/admin/login.cy.ts` | `{hars_folder}/admin/login.cy.har` |

> [!IMPORTANT]
> To record a HAR for each spec in the interactive mode (`cypress open`), you must enable the "experimentalInteractiveRunEvents" feature. For more details, see the documentation: https://docs.cypress.io/guides/references/experiments#Configuration

The same options as [`cy.recordHar()`](#recordhar) and [`cy.saveHar()`](#savehar) can be passed to `install`, and they apply to the HAR of each spec:

```js
install(on, config, {
  includeHosts: ['api.example.com'],
  maxTotalBufferSize: 100 * 1024 ** 2,
  maxWaitDuration: 10000
});
```

The HAR is always named after the spec and written to `hars_folder`, so `fileName` and `outDir` are not accepted. As with `cy.recordHar()`, the `filter` and `transform` paths are relative to the spec folder unless `rootDir` is set, for example to `config.projectRoot`.

As with `cy.saveHar()`, the HAR of each spec waits for the network to be idle before it is saved, so requests still running when the spec ends are kept. It waits up to `maxWaitDuration` (5 seconds by default) for each spec, so a spec that keeps polling ends up to that much later. Pass `waitForIdle: false` to save right away.

To keep only what the failed tests sent, pass `failedTestsOnly: true`:

```js
install(on, config, { failedTestsOnly: true });
```

The HAR then has only the entries of the [tests](#recordhar) whose try failed, with their pages, and a spec where no test failed gets no HAR. A test that passes on a retry keeps the entries of its failed tries, and a failed `before` hook counts against the first test, as Cypress reports it. Requests sent before the first test, or by a test that passed, are left out. Because nothing is written for a passing spec, a HAR from an earlier run is left in place. Cypress reports which tests failed only in `cypress run`, so `cypress open` keeps every entry. Do not combine it with [`cy.replayHar()`](#replayhar), whose spec HAR must hold every test.

To control what is recorded and when with the [commands](#commands) instead, turn this off:

```js
import { defineConfig } from 'cypress';
import { install } from '@neuralegion/cypress-har-generator';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      install(on, config, { lifecycle: false });
    }
  }
});
```

Then include the following code in your test file(s):

```js
describe('my tests', () => {
  before(() => {
    // start recording
    cy.recordHar();
  });

  after(() => {
    // save the HAR file
    cy.saveHar();
  });
});
```

By default, the plugin will save the generated HAR file to the root of your project with a file name that includes the current spec's name (e.g. `{specName}.har`).

> [!NOTE]
> The plugin records only what the browser sends. Requests that Cypress sends from Node, such as `cy.request()`, and requests made in `cy.task()` handlers never reach the browser, so they are not in the HAR.

You can also specify a different destination folder for the generated HAR file by setting the `hars_folder` field in the `expose` object in your Cypress config file:

```json
{
  "expose": {
    "hars_folder": "cypress/hars"
  }
}
```

Alternatively, you can pass the `hars_folder` variable in the CLI using the `--expose` option:

```bash
$ cypress run --browser chrome --expose hars_folder=cypress/hars
```

Finally, to start running your tests, use the following command:

```bash
$ cypress run --browser chrome
```

> [!IMPORTANT]
> Currently, only Chrome family browsers are supported. But this plugin also works with Electron, you just need to set the remote-debugging-port option when you launch Cypress as follows:
>
> ```bash
> $ ELECTRON_EXTRA_LAUNCH_ARGS=--remote-debugging-port=9222 cypress run --browser electron
> ```
>
> Please refer to the [Electron documentation](https://www.electronjs.org/docs/latest/api/command-line-switches#--remote-debugging-portport) and the [Cypress documentation](https://docs.cypress.io/api/plugins/browser-launch-api#Modify-Electron-app-switches) for more information on how to properly configure this switch.

## Commands

The plugin provides two main commands for work with HTTP Archive (HAR) files in your Cypress tests: `recordHar` and `saveHar`.

### recordHar

Starts recording network logs. All network requests made during the browser session will be recorded.

Here's an example of how to use the `recordHar` command:

```js
cy.recordHar();
```

> [!WARNING]
> The maximum size of a single resource that can be preserved is 10MB. If you need to receive a larger response body, you should adjust the `maxResourceBufferSize` and `maxTotalBufferSize` accordingly:
>
> ```js
> cy.recordHar({
>   maxTotalBufferSize: 1024 ** 3,
>   maxResourceBufferSize: 100 * 1024 ** 2
> });
> ```
>
> However, note that the resource buffer size cannot be greater than 256MB due to [the limit](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/devtools/devtools_http_handler.cc;l=90?aq=kSendBufferSizeForDevTools&ss=chromium) for WebSocket connections in Chrome.

You can set the `content` boolean flag to `false` to skip loading `content` field in the HAR.

```js
cy.recordHar({ content: false });
```

To include only requests on specific hosts, you can pass an array of patterns specifying a list of hosts using the `includeHosts` for which to record requests:

```js
cy.recordHar({ includeHosts: [/.*\.execute-api\.eu-west-1\.amazonaws\.com/] });
```

A host name, such as `'api.example.com'`, `'localhost:8080'` or `'[::1]'`, matches only that host, ignoring case, and any port unless the name has one. It does not match `evil-api.example.com` or `api.example.com.attacker.net`, nor subdomains: use a regular expression for those, such as `/(^|\.)example\.com(:\d+)?$/`, which is tested against the host with its port. Any other string is read as the source of a regular expression.

To exclude requests on specific hosts, such as analytics, CDNs or auth providers, pass `excludeHosts`, whose patterns match as in `includeHosts`. A host excluded is not recorded, even when `includeHosts` has it:

```js
cy.recordHar({
  includeHosts: [/(^|\.)example\.com(:\d+)?$/],
  excludeHosts: ['analytics.example.com']
});
```

To record only requests to the app under test, set `includeBaseUrlHost`, which adds the host of the Cypress `baseUrl`, with its port, to `includeHosts`. It throws a `TypeError` when `baseUrl` is not set:

```js
// with `baseUrl: 'http://localhost:8080'`, records only requests to `localhost:8080` and `api.example.com`
cy.recordHar({ includeBaseUrlHost: true, includeHosts: ['api.example.com'] });
```

To exclude some requests, you can pass an array of patterns specifying a list of paths using the `excludePaths` to be excluded from the logs:

```js
cy.recordHar({ excludePaths: [/^\/login/, /logout$/] });
```

By default, `excludePaths` is `[/^\/__(cypress[\w-]*)?\//]`, which leaves out the requests Cypress itself makes on your app's origin, such as `/__/`, `/__cypress/` and `/__cypress-cy-prompt/`. Passing `excludePaths` replaces this default, so add the pattern to your list to keep excluding them, or pass an empty array to record them:

```js
cy.recordHar({ excludePaths: [/^\/__(cypress[\w-]*)?\//, /^\/login/] });
cy.recordHar({ excludePaths: [] });
```

You can also pass an array of MIME types for which to record requests:

```js
cy.recordHar({ includeMimes: ['application/json'] });
```

This will record only requests with a MIME type of `application/json`.

To exclude requests based on their status code, pass an array of the status codes you want to exclude from the recorded HAR file:

```js
cy.recordHar({ excludeStatusCodes: [200, 201, 204] });
```

By default, the recorded HAR file leaves out blob requests, as they only make sense on the page that created them. To record them as well, set `includeBlobs` to true as follows:

```js
cy.recordHar({ includeBlobs: true });
```

You can specify the `filter` option as a path to a module that exports a function (it can be sync or async) to filter out unwanted entries from the HAR. The function should take an [Entry object](http://www.softwareishard.com/blog/har-12-spec/#entries) as a parameter and return a boolean indicating whether the entry should be excluded from the final HAR.

> [!NOTE]
> Unlike `Array.prototype.filter`, returning `true` drops the entry and returning `false` keeps it.

Here's an example of how to use the `filter` option:

```js
cy.recordHar({ filter: '../support/exclude-password.ts' });
```

And here's an example of what the `exclude-password.ts` filter module might look like:

```ts
import { Entry } from 'har-format';

export default async (entry: Entry) => {
  try {
    return /\"password":/.test(entry.request.postData.text ?? '');
  } catch {
    return false;
  }
};
```

In this example, the `filter` function excludes the entries whose request body contains a JSON object with a password field, and keeps all the others.

You can also modify the entries before saving the HAR by using the `transform` option. This option should be set to a path to a module that exports a function, similar to the filter option, to change the Entry object as desired.

```js
cy.recordHar({ transform: '../support/remove-sensitive-data.ts' });
```

Here's a simple example of what the `remove-sensitive-data.ts` module might look like:

```ts
import { Entry } from 'har-format';

const JSON_PASSWORD_REGEXP = /("password"\s*:\s*)"(?:[^"\\]|\\.)*"/g;
const FORM_PASSWORD_REGEXP = /((?:^|&)password=)[^&]*/g;

export default async (entry: Entry) => {
  const { postData } = entry.request;

  // Remove sensitive information from the request body
  if (postData?.text) {
    postData.text = postData.text
      .replace(JSON_PASSWORD_REGEXP, '$1"***"')
      .replace(FORM_PASSWORD_REGEXP, '$1***');
  }

  // Form requests also carry the parsed fields in `params`
  postData?.params?.forEach(param => {
    if (param.name === 'password') {
      param.value = '***';
    }
  });

  return entry;
};
```

The function should take an Entry object as a parameter and return the modified.

In this example, the transform function will replace the value of every `password` field in a JSON or form request body with `***`.

> [!TIP]
> The plugin also supports files with `.js`, `.mjs` and `.cjs` extensions, written as ES modules or CommonJS. For example, the same filter as a CommonJS module, `exclude-password.cjs`:
>
> ```js
> module.exports = entry =>
>   /\"password":/.test(entry.request.postData?.text ?? '');
> ```

By default, the path is relative to the spec folder. But by providing a `rootDir` it will look for the module in the provided directory:

```js
cy.recordHar({
  filter: 'cypress/support/exclude-password.ts',
  rootDir: Cypress.config('projectRoot')
});
```

To keep one entry for each request that the page sends again and again, such as a poll, set `dedupe` to `true`. Requests with the same method, URL and body count as one, and the HAR keeps the one that started first. This keeps a HAR fed to a scanner small, without changing which requests it covers:

```js
cy.recordHar({ dedupe: true });
```

The check applies after `filter` and `transform`, so it compares the entries as they are saved. Headers are not compared, since they often differ only in tokens or cookies. WebSocket and server-sent event entries with messages are always kept.

To compare the HAR of a run with the HAR of an earlier one, such as in a snapshot test or a code review, set `stable` to `true`. It leaves out the values that change on every run, as Playwright does when it omits timing:

```js
cy.recordHar({ stable: true });
```

| Field                                              | With `stable: true`        |
| -------------------------------------------------- | -------------------------- |
| `startedDateTime` of the entries, pages and tests  | `1970-01-01T00:00:00.000Z` |
| `time`, `timings`                                  | `-1`                       |
| `time` of WebSocket and server-sent event messages | `-1`                       |
| `connection`                                       | removed                    |

The entries keep their order by start time, so requests sent at the same time can still swap places between runs. The headers, such as `Date`, and the bodies are kept as the server sent them. It applies after `filter` and `transform`, which still get the real times.

The headers and the bodies often hold values that change on every run too, such as the `Date` header, session cookies, request IDs and the IDs and timestamps in a JSON body. They depend on your app, so leave them out with a `transform`:

```js
cy.recordHar({ stable: true, transform: '../support/remove-volatile-data.ts' });
```

<details>
<summary>Here's what the <code>remove-volatile-data.ts</code> module might look like</summary>

```ts
import type { Entry, PostData } from 'har-format';

// the headers and JSON fields whose values change on every run: add the ones your app sends
const VOLATILE_HEADERS = new Set([
  'date',
  'content-length',
  'expires',
  'age',
  'cookie',
  'set-cookie',
  'etag',
  'x-request-id',
  'traceparent',
  'server-timing'
]);
const VOLATILE_FIELDS = new Set([
  'id',
  'token',
  'createdAt',
  'updatedAt',
  'timestamp'
]);

const mask = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(mask);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, x]) => [
        key,
        VOLATILE_FIELDS.has(key) ? '***' : mask(x)
      ])
    );
  }

  return value;
};

const maskJson = (text: string): string => {
  try {
    return JSON.stringify(mask(JSON.parse(text)));
  } catch {
    // not a JSON body
    return text;
  }
};

const maskBody = (body?: PostData | Entry['response']['content']): void => {
  if (body?.text && !('encoding' in body && body.encoding === 'base64')) {
    body.text = maskJson(body.text);
  }
};

export default (entry: Entry): Entry => {
  for (const message of [entry.request, entry.response]) {
    message.headers = message.headers.filter(
      ({ name }) => !VOLATILE_HEADERS.has(name.toLowerCase())
    );
    // the cookies come from the removed `Cookie` and `Set-Cookie` headers
    message.cookies = [];
    // the sizes as sent depend on the values masked here, so they are left out as HAR 1.2 allows
    message.headersSize = -1;
    message.bodySize = -1;
  }

  maskBody(entry.request.postData);
  maskBody(entry.response.content);

  const { content } = entry.response;

  content.size = Buffer.byteLength(
    content.text ?? '',
    content.encoding === 'base64' ? 'base64' : 'utf-8'
  );
  delete content.compression;
  delete entry.response._transferSize;

  return entry;
};
```

</details>

It removes the listed headers with the cookies parsed from them, and replaces the listed fields of a JSON body with `***`, at any depth. Since the masked values can differ in length, it also leaves out the sizes measured on the wire, which HAR 1.2 allows with `-1`, and sets `content.size` to the size of the masked body.

A HAR can hold bodies of many megabytes, which make it slow to open, read or share. To keep it small, cut the long bodies with a `transform`:

```js
cy.recordHar({ transform: '../support/cut-long-bodies.ts' });
```

<details>
<summary>Here's what the <code>cut-long-bodies.ts</code> module might look like</summary>

```ts
import type { Content, Entry, PostData } from 'har-format';

// the most characters of a body to keep
const MAX_BODY_LENGTH = 10_000;

const cut = (body: Content | PostData, base64: boolean): void => {
  const { text } = body;

  if (!text || text.length <= MAX_BODY_LENGTH) {
    return;
  }

  // a base64 body cut at a multiple of 4 characters still decodes, to its first bytes
  body.text = text.slice(
    0,
    base64 ? MAX_BODY_LENGTH - (MAX_BODY_LENGTH % 4) : MAX_BODY_LENGTH
  );
  body.comment = `cut to the first ${body.text.length} of ${text.length} characters`;
};

export default (entry: Entry): Entry => {
  cut(entry.response.content, entry.response.content.encoding === 'base64');

  if (entry.request.postData) {
    cut(entry.request.postData, false);
  }

  return entry;
};
```

</details>

It keeps the first `MAX_BODY_LENGTH` characters of each response and request body, and tells in the `comment` of the body, a HAR 1.2 field, how long the body was. A base64 body is cut at a multiple of 4 characters, so it still decodes to its first bytes, and `content.size` keeps the size of the whole body. Chrome drops a response body larger than `maxResourceBufferSize` before `transform` gets it, so raise that limit to cut such a body instead of losing it. Do not replay a HAR with cut bodies, since `cy.replayHar()` would serve them cut.

The HAR groups the entries by page, as Chrome DevTools exports it: each document the app loads, such as with `cy.visit()` or a link, is a page of `log.pages`, and each entry has the `pageref` of the page whose document sent it. The requests of an iframe belong to the page that holds the iframe, and a popup has pages of its own. A page is titled with its URL and keeps no timings, so `pageTimings` is empty. A request sent by a document loaded before `cy.recordHar()`, or left out of the HAR by the options, has no `pageref`.

The HAR also lists the tests that sent its requests, in the custom `log._tests` field, the way `log.pages` lists the pages, so you can find the requests of a failed test or of one try of a retried test. Each try of a test is listed once, in the order the tries started, and each entry has the `_testref` of the test that sent it:

```json
"_tests": [
  {
    "startedDateTime": "2026-10-28T13:20:00.000Z",
    "id": "test_1",
    "titlePath": ["Cart", "adds an item"],
    "attempt": 2,
    "state": "passed"
  }
],
"entries": [{ "pageref": "page_1", "_testref": "test_1", ... }]
```

`titlePath` holds the titles of the suites and of the test, as `Cypress.currentTest.titlePath` does, and `attempt` counts the tries from `1`. In the HAR recorded for each spec, `state` tells how the try ended, as Cypress reports it in [`after:spec`](https://docs.cypress.io/api/node-events/after-spec-api), e.g. `passed` or `failed`. `cy.saveHar()` runs before Cypress has the result of the last test, and `cypress open` reports no results, so there the tests have no `state`. A request belongs to the test that was running when the request started, and a test that sent no request is left out. Cypress runs the `before` hooks within the first test and the `after` hooks within the last one, so their requests belong to those tests. A request sent before any test started has no `_testref`. With `stable`, the tests start at `1970-01-01T00:00:00.000Z`, like the pages. The page tells the plugin which test started through a function the plugin adds to it while recording, so the commands send nothing and break nothing when no recording is active.

### saveHar

Stops recording and saves all requests that have occurred since `recordHar` was run to a HAR file. By default, the file is saved to the root of the project with a file name that includes the current spec's name (e.g. `{specName}.har`).

```js
cy.saveHar();
```

You can pass a file name to change the default naming behavior.

```js
cy.saveHar({ fileName: 'example.com.har' });
```

Only the name is used, so a folder in `fileName`, as in `hars/example.com.har`, is dropped. To choose the folder, use `outDir`.

You can customize a destination folder overriding any previous settings:

```js
cy.saveHar({ outDir: './hars' });
```

By default, `saveHar` waits for all pending requests to complete before saving the HAR file: it monitors the count of pending requests and waits for it to reach zero, so all responses have been received and the data in the file is complete. Open WebSockets do not hold it up. To save right away instead, pass `waitForIdle: false`:

```js
cy.saveHar({ waitForIdle: false });
```

You can pass the `maxWaitDuration` option to specify the maximum time to wait for the pending requests to complete:

```js
cy.saveHar({ maxWaitDuration: 20000 });
```

The `maxWaitDuration` option is set to 5000 milliseconds by default, meaning it will wait for 5 seconds until all pending requests have completed.

You can also pass the `minIdleDuration` option to specify the minimum duration in milliseconds to wait for the network idle during the `maxWaitDuration` time. The network is idle if there are no pending requests during this time.

```js
cy.saveHar({ minIdleDuration: 1000 });
```

The `minIdleDuration` option is set to 100 milliseconds by default.

### disposeOfHar

Stops the ongoing recording of network requests and disposes of the recorded logs, which will be not saved to a HAR file.

You may use this command if you have started recording network logs with `recordHar` command, but you decide to refuse to save the recorded logs to a HAR file.
Here's an example of how you might use this command to dispose of the HAR:

```js
describe('my tests', () => {
  beforeEach(() => {
    // start recording
    cy.recordHar();
  });

  afterEach(function () {
    const { state } = this.currentTest;
    if (state === 'passed') {
      // decide not to save the recorded logs
      cy.disposeOfHar();
    }
  });
});
```

### replayHar

Serves the requests of the test with the responses recorded in a HAR, as Playwright's [`routeFromHAR`](https://playwright.dev/docs/mock#mocking-with-har-files) does, so a spec can run against the traffic of an earlier run instead of the real backend. It is built on `cy.intercept()`, so it works in any browser and does not need a recording to be active.

Without a path, it works like a snapshot: it replays the HAR that the plugin writes for the spec to `hars_folder`, and the first run records it:

```js
beforeEach(() => {
  cy.replayHar();
});
```

| HAR of the spec | `hars_update`         | `cy.replayHar()`                                                       |
| --------------- | --------------------- | ---------------------------------------------------------------------- |
| missing         | `'missing'` (default) | lets the requests reach the server, and the spec records its HAR       |
| exists          | `'missing'` (default) | serves the requests from the HAR, which is not written again           |
| any             | `'all'`               | lets the requests reach the server, and the spec records its HAR again |
| missing         | `'none'`              | fails the test                                                         |
| exists          | `'none'`              | serves the requests from the HAR                                       |

Set `hars_update` through `expose`, as `hars_folder`. Use `all` to record the HARs again after the backend changes, and `none` in CI, so a missing HAR fails the run instead of being recorded:

```bash
npx cypress run --expose hars_update=all
npx cypress run --expose hars_update=none
```

Recording needs the HAR recorded for each spec, so it does not work with `lifecycle: false`, or in `cypress open` without [`experimentalInteractiveRunEvents`](https://docs.cypress.io/guides/references/experiments#Configuration): there, a missing HAR fails the test. Each test is served the entries it sent, found by its title in the [`log._tests`](#recordhar) of the HAR, so `it.only`, a skipped test or a change in order does not change which response a request gets. A test tried more than once is served the entries of its last try, and each try starts from the first of them. A test missing from `_tests`, e.g. one added after recording, or a HAR recorded without `_tests`, is served from all the entries of the HAR in the recorded order, going on from where the previous such test stopped.

> [!WARNING]
> Commit the HARs you replay, so do not ignore `hars_folder` in Git. A HAR keeps cookies, tokens and the other headers and bodies of the recorded traffic: remove the secrets before committing it.

To replay a HAR file you pass yourself, give its path, relative to the project root. Each call serves it from its first entry:

```js
cy.replayHar('cypress/hars/products.har');
cy.visit('/products');
```

A request is served by the entry with the same method, URL and body. A JSON body matches regardless of its formatting, and the fragment of the URL is ignored. When several entries match, they are served in the recorded order, and the last one keeps being served after that. The response is served with the recorded status, headers and body, and a body recorded in base64 is decoded. An entry with the status `0`, i.e. a request that got no response, fails with a network error.

By default, a request that no entry matches fails with a network error. To pass it on to your other `cy.intercept()` handlers and the network instead, pass `notFound: 'fallback'`:

```js
cy.replayHar({ notFound: 'fallback' });
cy.replayHar('cypress/hars/products.har', { notFound: 'fallback' });
```

To serve only some requests from the HAR, pass a glob pattern or a regular expression in `url`, as for `cy.intercept()`. The other requests reach the network as usual:

```js
cy.replayHar({ url: '**/api/**' });
```

> [!NOTE]
> Pages are always loaded from the server: Cypress injects its runner script into each page it loads, so a page recorded through Cypress already carries that script and would run it twice. WebSocket and server-sent event entries are not served: `cy.intercept()` cannot reply with WebSocket frames or an event stream, and a HAR keeps no body for an event stream. `cy.intercept()` takes one value per header, so of several recorded `Set-Cookie` headers only the first one is served. The status text and the timings of the recorded response are not replayed.

## Example Usage

In a browser outside the Chrome family, such as Firefox, the plugin warns once and records nothing, so the examples below need no check of the browser.

To keep a HAR of each spec that failed in CI, and attach the HARs to the failed job, pass [`failedTestsOnly`](#generating-a-har-file):

```js
import { defineConfig } from 'cypress';
import { install } from '@neuralegion/cypress-har-generator';

export default defineConfig({
  expose: { hars_folder: 'cypress/hars' },
  e2e: {
    setupNodeEvents(on, config) {
      install(on, config, { failedTestsOnly: true });
    }
  }
});
```

```yaml
# .github/workflows/e2e.yml
- uses: cypress-io/github-action@v7
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: hars
    path: cypress/hars
```

To serve the API of a spec from its own HAR, recorded on the first run and replayed on the next ones, call [`cy.replayHar()`](#replayhar). Requests outside `url` reach the network as usual:

```js
beforeEach(() => {
  cy.replayHar({ url: '**/api/**' });
});
```

To give a scanner, such as [Bright](https://brightsec.com), one entry for each request the app sends to its own host, pass [`dedupe`](#recordhar) and [`includeBaseUrlHost`](#recordhar):

```js
install(on, config, { dedupe: true, includeBaseUrlHost: true });
```

To record only one part of a test, turn the HAR of each spec off with `lifecycle: false`, and use the [commands](#commands):

```js
it('checks out', () => {
  cy.visit('/cart');

  cy.recordHar({ includeHosts: ['api.example.com'] });
  cy.get('[data-cy=checkout]').click();
  cy.saveHar({ fileName: 'checkout.har' });
});
```

## License

Copyright © 2024 [Bright Security](https://brightsec.com/).

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
