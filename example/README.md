# Example cypress-har-generator

This is a demo project for the [cypress-har-generator](https://github.com/BrightSec/cypress-har-generator), with some installation and usage examples.

## Install

To install the necessary dependencies, run the following command:

```bash
$ npm ci
```

## How to run

To run the tests and generate the HAR file, use the following command:

```bash
$ npm t
```

The generated file can be found in the following folder: `./cypress/hars`.

## Additional information

You can find the test files in the `./cypress/e2e` folder. The generated HAR file will capture all the network requests made during the test run. This can be useful for debugging and performance analysis.
