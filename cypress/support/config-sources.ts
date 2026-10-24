// `Cypress.expose()` is available since Cypress 15.10, and `Cypress.env()` is removed in Cypress 16, where it throws.
// The plugin reads both, so each test runs against the API the running Cypress version provides.
type Variables = (key: string, value?: unknown) => unknown;

const [major, minor]: number[] = Cypress.version.split('.').map(Number);

export interface ConfigSource {
  name: string;
  supported: boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

const fromApi = (name: string, supported: boolean): ConfigSource => {
  const api = (): Variables =>
    (Cypress as unknown as Record<string, Variables>)[name];

  return {
    name,
    supported,
    get: key => api()(key),
    set: (key, value) => void api()(key, value)
  };
};

export const expose = fromApi(
  'expose',
  major > 15 || (major === 15 && minor >= 10)
);
export const env = fromApi('env', major < 16);
