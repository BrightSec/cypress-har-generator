import { enableExperimentalLifecycle, install } from './index.ts';
import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const createEvents = () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const on = ((event: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(event, handler)) as unknown as Cypress.PluginEvents;

  return { handlers, on };
};

describe('install', () => {
  const config = { isTextTerminal: true } as Cypress.PluginConfigOptions;

  it('should not record a HAR for each spec by default', () => {
    // arrange
    const { handlers, on } = createEvents();

    // act
    install(on, config);

    // assert
    expect(handlers.has('before:spec')).toBe(false);
    expect(handlers.has('after:spec')).toBe(false);
  });

  it('should record a HAR for each spec when the lifecycle is enabled', () => {
    // arrange
    const { handlers, on } = createEvents();

    // act
    install(on, config, { lifecycle: true });

    // assert
    expect(handlers.has('before:spec')).toBe(true);
    expect(handlers.has('after:spec')).toBe(true);
  });

  it('should throw when the lifecycle is enabled without the config', () => {
    // arrange
    const { on } = createEvents();

    // act & assert
    expect(() => install(on, undefined, { lifecycle: true })).toThrow(
      TypeError
    );
  });

  it.each([
    { source: { expose: { hars_folder: 'hars' } }, expected: 'hars' },
    { source: { env: { hars_folder: 'hars' } }, expected: '.' },
    { source: { expose: { HARS_FOLDER: 'hars' } }, expected: '.' }
  ])(
    'should save the HAR of each spec to $expected when the config has $source',
    async ({ source, expected }) => {
      // arrange
      const saveHar = jest
        .spyOn(Plugin.prototype, 'saveHar')
        .mockResolvedValue(undefined);
      const { handlers, on } = createEvents();
      install(on, { ...config, ...source } as Cypress.PluginConfigOptions, {
        lifecycle: true
      });

      // act
      await handlers.get('after:spec')?.({ name: 'spec.cy.ts' }, {});

      // assert
      expect(saveHar).toHaveBeenCalledWith(
        expect.objectContaining({ outDir: expected })
      );
      saveHar.mockRestore();
    }
  );
});

describe('enableExperimentalLifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should warn once that it is deprecated', () => {
    // arrange
    const warn = jest
      .spyOn(Logger.Instance, 'warn')
      .mockImplementation(() => undefined);
    const { on } = createEvents();
    const config = { isTextTerminal: true } as Cypress.PluginConfigOptions;

    // act
    enableExperimentalLifecycle(on, config);
    enableExperimentalLifecycle(on, config);

    // assert
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('install(on, config, { lifecycle: true })')
    );
  });

  it('should start recording in the folder of the spec before it runs', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    const config = { isTextTerminal: true } as Cypress.PluginConfigOptions;
    enableExperimentalLifecycle(on, config);

    // act
    await handlers.get('before:spec')?.({
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });

    // assert
    expect(recordHar).toHaveBeenCalledWith({
      content: true,
      rootDir: '/project/cypress/e2e'
    });
  });
});
