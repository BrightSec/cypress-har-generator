export const PORT_OPTION_NAME = '--remote-debugging-port';
export const ADDRESS_OPTION_NAME = '--remote-debugging-address';
export const SUPPORTED_BROWSERS: readonly string[] = ['chromium'];
export const MAX_NETWORK_IDLE_THRESHOLD = 100;
export const MAX_NETWORK_IDLE_DURATION = 5000;
// Cypress serves its runner and its own requests from the app's origin, under `/__/`, `/__cypress/`,
// `/__cypress-studio/` and `/__cypress-cy-prompt/`
export const DEFAULT_EXCLUDE_PATHS: readonly string[] = [
  '^\\/__(cypress[\\w-]*)?\\/'
];
export const HARS_FOLDER_KEY = 'hars_folder';
