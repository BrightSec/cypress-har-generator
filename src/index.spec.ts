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
    { env: { hars_folders: 'hars' } },
    { expose: { HARS_FOLDERS: 'hars' } }
  ])(
    'should warn that hars_folders is deprecated when it is set in %j',
    source => {
      // arrange
      const deprecate = jest
        .spyOn(Logger.Instance, 'deprecate')
        .mockImplementation(() => undefined);
      const { on } = createEvents();

      // act
      install(on, { ...config, ...source } as Cypress.PluginConfigOptions);

      // assert
      expect(deprecate).toHaveBeenCalledWith(
        'hars_folders',
        expect.stringContaining('hars_folder')
      );
      deprecate.mockRestore();
    }
  );

  it('should not warn about hars_folders when only hars_folder is set', () => {
    // arrange
    const deprecate = jest
      .spyOn(Logger.Instance, 'deprecate')
      .mockImplementation(() => undefined);
    const { on } = createEvents();

    // act
    install(on, {
      ...config,
      env: { hars_folder: 'hars' }
    } as unknown as Cypress.PluginConfigOptions);

    // assert
    expect(deprecate).not.toHaveBeenCalled();
    deprecate.mockRestore();
  });
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
      includeBlobs: true,
      rootDir: '/project/cypress/e2e'
    });
  });
});
