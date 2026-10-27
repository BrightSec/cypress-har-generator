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
    setupNodeEvents(on) {
      install(on);
    }
  }
});
```

> [!TIP]
> The plugin ships both ES modules and CommonJS, so a CommonJS config can load it with `require('@neuralegion/cypress-har-generator')` instead.

> [!NOTE]
> `setupNodeEvents` can be defined in either the e2e or component configuration

> [!WARNING]
> `setupNodeEvents` does not support multiple `on` event listeners without overwriting previously defined listeners. To work around this issue, you can either call the `install` function at the end of the `setupNodeEvents` function, or use the deprecated `ensureBrowserFlags` as follows:
>
> ```js
> import { defineConfig } from 'cypress';
> import {
>   install,
>   ensureBrowserFlags
> } from '@neuralegion/cypress-har-generator';
>
> export default defineConfig({
>   e2e: {
>     setupNodeEvents(on) {
>       install(on);
>       on('before:browser:launch', (browser = {}, launchOptions) => {
>         ensureBrowserFlags(browser, launchOptions);
>         return launchOptions;
>       });
>     }
>   }
> });
> ```
>
> For more information, see [this GitHub issue](https://github.com/cypress-io/cypress/issues/5240).

### Registering the commands

Add the following line to your [support file](https://docs.cypress.io/app/core-concepts/writing-and-organizing-tests#Support-file), which is `cypress/support/e2e.js` by default (`cypress/support/e2e.ts` for TypeScript projects):

```js
import '@neuralegion/cypress-har-generator/commands';
```

> [!IMPORTANT]
> Make sure the line is in the file that Cypress actually loads, which is the one set by the `supportFile` option. With CommonJS, use `require('@neuralegion/cypress-har-generator/commands');` instead.

The import also adds the types of the commands, so TypeScript knows `cy.recordHar`, `cy.saveHar` and `cy.disposeOfHar` without any further configuration.

## Generating a HAR File

To generate a HAR file, you'll need to include the following code in your test file(s):

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

To exclude some requests, you can pass an array of patterns specifying a list of paths using the `excludePaths` to be excluded from the logs:

```js
cy.recordHar({ excludePaths: [/^\/login/, /logout$/] });
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

You can specify the `filter` option as a path to a module that exports a function (it can be sync or async) to filter out unwanted entries from the HAR. The function should take an [Entry object](http://www.softwareishard.com/blog/har-12-spec/#entries) as a parameter and return a boolean indicating whether the entry should be included in the final HAR or not.

Here's an example of how to use the `filter` option:

```js
cy.recordHar({ filter: '../support/include-password.ts' });
```

And here's an example of what the `include-password.ts` filter module might look like:

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

In this example, the `filter` function will only exclude entries in the HAR where the request body contains a JSON object with a password field.

You can also modify the entries before saving the HAR by using the `transform` option. This option should be set to a path to a module that exports a function, similar to the filter option, to change the Entry object as desired.

```js
cy.recordHar({ transform: '../support/remove-sensitive-data.ts' });
```

Here's a simple example of what the `remove-sensitive-data.ts` module might look like:

```ts
import { Entry } from 'har-format';

const PASSWORD_REGEXP = /("password":\s*")\w+("\s*)/;

export default async (entry: Entry) => {
  try {
    // Remove sensitive information from the request body
    if (entry.request.postData?.text) {
      entry.request.postData.text = entry.request.postData.text.replace(
        PASSWORD_REGEXP,
        '$1***$2'
      );
    }

    return entry;
  } catch {
    return entry;
  }
};
```

The function should take an Entry object as a parameter and return the modified.

In this example, the transform function will replace any occurrences of password with `***` in the request body of each entry.

> [!TIP]
> The plugin also supports files with `.js`, `.mjs` and `.cjs` extensions, written as ES modules or CommonJS. For example, the same filter as a CommonJS module, `include-password.cjs`:
>
> ```js
> module.exports = entry =>
>   /\"password":/.test(entry.request.postData?.text ?? '');
> ```

By default, the path is relative to the spec folder. But by providing a `rootDir` it will look for the module in the provided directory:

```js
cy.recordHar({
  filter: 'cypress/support/include-password.ts',
  rootDir: Cypress.config('projectRoot')
});
```

### saveHar

Stops recording and saves all requests that have occurred since `recordHar` was run to a HAR file. By default, the file is saved to the root of the project with a file name that includes the current spec's name (e.g. `{specName}.har`).

```js
cy.saveHar();
```

You can pass a file name to change the default naming behavior.

```js
cy.saveHar({ fileName: 'example.com.har' });
```

You can customize a destination folder overriding any previous settings:

```js
cy.saveHar({ outDir: './hars' });
```

You can also pass the `waitForIdle` option to wait for all pending requests to complete before saving the HAR file:

```js
cy.saveHar({ waitForIdle: true });
```

This option is false by default. When set to true, the plugin will monitor the count of pending requests and wait for it to reach zero before proceeding with saving the HAR file. This ensures that all responses have been received and the data in the file is complete and accurate.

Additionally, you can pass the `maxWaitDuration` option to specify the maximum time to wait for the pending requests to complete:

```js
cy.saveHar({ waitForIdle: true, maxWaitDuration: 20000 });
```

The `maxWaitDuration` option is set to 5000 milliseconds by default, meaning it will wait for 5 seconds until all pending requests have completed.

You can also pass the `minIdleDuration` option to specify the minimum duration in milliseconds to wait for the network idle during the `maxWaitDuration` time. The network is idle if there are no pending requests during this time.

```js
cy.saveHar({ waitForIdle: true, minIdleDuration: 1000 });
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

## Example Usage

To generate a HAR file during your tests, you'll need to include the `recordHar` and `saveHar` commands in your test file(s). Here's an example of how you might use these commands in a test:

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

You can also generate a HAR file only for Chrome browser sessions, if it is not interactive run, and only if the test has failed:

```js
describe('my tests', () => {
  beforeEach(() => {
    const isInteractive = Cypress.config('isInteractive');
    const isChrome = Cypress.browser.name === 'chrome';
    if (!isInteractive && isChrome) {
      cy.recordHar();
    }
  });

  afterEach(function () {
    const { state } = this.currentTest;
    const isInteractive = Cypress.config('isInteractive');
    const isChrome = Cypress.browser.name === 'chrome';
    if (!isInteractive && isChrome && state !== 'passed') {
      cy.saveHar();
    }
  });
});
```

You can set up hooks in a single step, eliminating the need to define them in each spec file. To do this, pass the config and `{ lifecycle: true }` to `install` as shown below:

```js
import { defineConfig } from 'cypress';
import { install } from '@neuralegion/cypress-har-generator';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      install(on, config, { lifecycle: true });
    }
  }
});
```

> [!IMPORTANT]
> To record a HAR for each spec this way, you must either disable the interactive mode or enable the "experimentalInteractiveRunEvents" feature. For more details, see the documentation: https://docs.cypress.io/guides/references/experiments#Configuration

> [!TIP]
> If a run can be stopped early, for example by `Cypress.stop()` or a plugin such as [cypress-fail-fast](https://github.com/javierbrea/cypress-fail-fast), Cypress skips the remaining `after` and `afterEach` hooks, so a `cy.saveHar()` call in them never runs. Use `{ lifecycle: true }` in that case: it saves the HAR from the Node process at the end of each spec, which happens even when the run is stopped.

> [!WARNING]
> `enableExperimentalLifecycle(on, config)` does the same and still works, but it is deprecated and will be removed in version 6.

## License

Copyright © 2024 [Bright Security](https://brightsec.com/).

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
