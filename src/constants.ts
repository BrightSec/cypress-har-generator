export const PORT_OPTION_NAME = '--remote-debugging-port';
export const ADDRESS_OPTION_NAME = '--remote-debugging-address';
export const SUPPORTED_BROWSERS: readonly string[] = ['chromium'];
export const MAX_NETWORK_IDLE_THRESHOLD = 100;
export const MAX_NETWORK_IDLE_DURATION = 5000;
// The upper-case name is what `CYPRESS_HARS_FOLDER` produces, as Cypress keeps the case of such variables.
export const HARS_FOLDER_KEYS: string[] = ['hars_folder', 'HARS_FOLDER'];
