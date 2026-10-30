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
  - The target may have closed during initialization.
  - The target may have crashed due to memory issues.

Please open an issue on the repository: https://github.com/BrightSec/cypress-har-generator/issues for assistance.`;
export const FAILED_TO_CONNECT = `${FAILED_ATTEMPT_TO_CONNECT}

Possible reasons for failure:
  - The browser was started without the '--remote-debugging-port' switch, e.g. a 'before:browser:launch' listener replaced the plugin's arguments.
  - The browser closed or crashed before the connection was made.`;
