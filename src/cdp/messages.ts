export const FAILED_ATTEMPT_TO_CONNECT =
  'Failed to connect to Chrome Debugging Protocol';
export const ATTEMPT_TO_CONNECT =
  'Attempting to connect to Chrome Debugging Protocol';
export const CONNECTED = 'Connected to Chrome Debugging Protocol';
export const DISCONNECTED = 'Chrome Debugging Protocol disconnected';
export const CONNECTION_NOT_ESTABLISHED = `Chrome Debugging Protocol connection has not been established.`;
export const TARGET_OR_BROWSER_CLOSED =
  'The target or browser may have closed before completion of initialization';
export const UNABLE_TO_ATTACH_TO_TARGET = `Unable to attach to the target (e.g. page, worker, etc). 

Possible reasons for the failure include:
  - Chrome not running in headless mode.
  - The target may have closed during initialization.
  - The target may have crashed due to memory issues.

Please open an issue on the repository: https://github.com/BrightSec/cypress-har-generator/issues for assistance.

The stack trace for this error is:`;
export const FAILED_TO_CONNECT = `${FAILED_ATTEMPT_TO_CONNECT}

Possible reasons for failure:
  - Chrome not running in headless mode
  - Using Chrome version 58 or earlier
  - Inconsistent RDP configuration settings.

The last error was: `;
