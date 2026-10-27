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

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('should record a HAR for each spec with the given recording options', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config, {
      lifecycle: true,
      content: false,
      includeBlobs: false,
      excludePaths: [/^\/__cypress\//],
      minStatusCodeToInclude: 400,
      maxTotalBufferSize: 1024,
      filter: 'filter.js',
      rootDir: '/project'
    });

    // act
    await handlers.get('before:spec')?.({
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });

    // assert
    expect(recordHar).toHaveBeenCalledWith({
      content: false,
      includeBlobs: false,
      excludePaths: [/^\/__cypress\//],
      minStatusCodeToInclude: 400,
      maxTotalBufferSize: 1024,
      filter: 'filter.js',
      rootDir: '/project'
    });
  });

  it('should save the HAR of each spec with the given saving options', async () => {
    // arrange
    const saveHar = jest
      .spyOn(Plugin.prototype, 'saveHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config, {
      lifecycle: true,
      waitForIdle: true,
      minIdleDuration: 200,
      maxWaitDuration: 3000
    });

    // act
    await handlers.get('after:spec')?.({ name: 'spec.cy.ts' }, {});

    // assert
    expect(saveHar).toHaveBeenCalledWith({
      waitForIdle: true,
      minIdleDuration: 200,
      maxWaitDuration: 3000,
      fileName: 'spec.cy.har',
      outDir: '.'
    });
  });

  it('should not pass the saving options to the recording', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config, { lifecycle: true, waitForIdle: true });

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

  it('should record only the hosts given and the host of the base URL', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(
      on,
      { ...config, baseUrl: 'http://localhost:8080' },
      {
        lifecycle: true,
        includeHosts: ['api.example.com'],
        excludeHosts: ['analytics.example.com'],
        includeBaseUrlHost: true
      }
    );

    // act
    await handlers.get('before:spec')?.({
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });

    // assert
    expect(recordHar).toHaveBeenCalledWith({
      content: true,
      includeBlobs: true,
      rootDir: '/project/cypress/e2e',
      includeHosts: ['api.example.com', 'localhost:8080'],
      excludeHosts: ['analytics.example.com']
    });
  });

  it('should throw when the host of the base URL is asked for without the base URL', () => {
    // arrange
    const { on } = createEvents();

    // act & assert
    expect(() =>
      install(on, config, { lifecycle: true, includeBaseUrlHost: true })
    ).toThrow(TypeError);
  });

  it('should warn when the recording options are given without the lifecycle', () => {
    // arrange
    const warn = jest
      .spyOn(Logger.Instance, 'warn')
      .mockImplementation(() => undefined);
    const { handlers, on } = createEvents();

    // act
    install(on, config, { content: false });

    // assert
    expect(handlers.has('before:spec')).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('{ lifecycle: true, ... }')
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

  it.each(['14.5.4', '15.9.0'])(
    'should warn that Cypress %s is deprecated',
    version => {
      // arrange
      const deprecate = jest
        .spyOn(Logger.Instance, 'deprecate')
        .mockImplementation(() => undefined);
      const { on } = createEvents();

      // act
      install(on, { ...config, version } as Cypress.PluginConfigOptions);

      // assert
      expect(deprecate).toHaveBeenCalledWith(
        'cypress-version',
        expect.stringContaining('15.10.0')
      );
      deprecate.mockRestore();
    }
  );

  it.each([
    { version: '15.10.0', env: { hars_folder: 'hars' } },
    { version: '16.2.0', env: { HARS_FOLDER: 'hars' }, expose: {} }
  ])(
    'should warn that reading hars_folder from env is deprecated in %j',
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
        'hars_folder-env',
        expect.stringContaining('expose')
      );
      expect(deprecate).not.toHaveBeenCalledWith(
        'cypress-version',
        expect.anything()
      );
      deprecate.mockRestore();
    }
  );

  it('should not warn when hars_folder is exposed on Cypress 15.10', () => {
    // arrange
    const deprecate = jest
      .spyOn(Logger.Instance, 'deprecate')
      .mockImplementation(() => undefined);
    const { on } = createEvents();

    // act
    install(on, {
      ...config,
      version: '15.10.0',
      expose: { hars_folder: 'hars' },
      env: { hars_folder: 'other' }
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
