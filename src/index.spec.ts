import { install } from './index.ts';
import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { DEFAULT_EXCLUDE_PATHS } from './constants.ts';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { join } from 'node:path';

const createEvents = () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const on = ((event: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(event, handler)) as unknown as Cypress.PluginEvents;

  return { handlers, on };
};

describe('install', () => {
  const config = {
    isTextTerminal: true,
    specPattern: 'cypress/e2e/**/*.cy.ts'
  } as Cypress.PluginConfigOptions;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should record a HAR for each spec by default', () => {
    // arrange
    const { handlers, on } = createEvents();

    // act
    install(on, config);

    // assert
    expect(handlers.has('before:spec')).toBe(true);
    expect(handlers.has('after:spec')).toBe(true);
  });

  it('should not record a HAR for each spec when the lifecycle is disabled', () => {
    // arrange
    const { handlers, on } = createEvents();

    // act
    install(on, config, { lifecycle: false });

    // assert
    expect(handlers.has('before:spec')).toBe(false);
    expect(handlers.has('after:spec')).toBe(false);
  });

  it('should throw without the config', () => {
    // arrange
    const { on } = createEvents();

    // act & assert
    expect(() =>
      install(on, undefined as unknown as Cypress.PluginConfigOptions)
    ).toThrow(TypeError);
  });

  it('should record a HAR for each spec with the given recording options', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config, {
      content: false,
      includeBlobs: false,
      excludePaths: [/^\/__cypress\//],
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
      waitForIdle: true,
      minIdleDuration: 200,
      maxWaitDuration: 3000
    });

    // act
    await handlers.get('after:spec')?.(
      { name: 'spec.cy.ts', relative: 'cypress/e2e/spec.cy.ts' },
      {}
    );

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
    install(on, config, { waitForIdle: true });

    // act
    await handlers.get('before:spec')?.({
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });

    // assert
    expect(recordHar).toHaveBeenCalledWith({
      content: true,
      excludePaths: [...DEFAULT_EXCLUDE_PATHS],
      rootDir: '/project/cypress/e2e'
    });
  });

  it('should warn when the recording options are given with the lifecycle disabled', () => {
    // arrange
    const warn = jest
      .spyOn(Logger.Instance, 'warn')
      .mockImplementation(() => undefined);
    const { handlers, on } = createEvents();

    // act
    install(on, config, { lifecycle: false, content: false });

    // assert
    expect(handlers.has('before:spec')).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('`lifecycle: false`')
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
      install(on, { ...config, ...source } as Cypress.PluginConfigOptions);

      // act
      await handlers.get('after:spec')?.(
        { name: 'spec.cy.ts', relative: 'cypress/e2e/spec.cy.ts' },
        {}
      );

      // assert
      expect(saveHar).toHaveBeenCalledWith(
        expect.objectContaining({ outDir: expected })
      );
      saveHar.mockRestore();
    }
  );

  it.each([
    {
      specPattern: 'cypress/e2e/**/*.cy.ts',
      relative: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: 'cypress/e2e/**/*.cy.ts',
      relative: 'cypress\\e2e\\a\\b\\login.cy.ts',
      expected: join('hars', 'a', 'b')
    },
    {
      specPattern: ['src/**/*.cy.ts', 'cypress/e2e/**/*.cy.ts'],
      relative: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: '**/*.cy.ts',
      relative: 'src/a/login.cy.ts',
      expected: join('hars', 'src', 'a')
    }
  ])(
    'should save the HAR of $relative to $expected when the spec pattern is $specPattern',
    async ({ specPattern, relative, expected }) => {
      // arrange
      const saveHar = jest
        .spyOn(Plugin.prototype, 'saveHar')
        .mockResolvedValue(undefined);
      const { handlers, on } = createEvents();
      install(on, {
        ...config,
        specPattern,
        expose: { hars_folder: 'hars' }
      } as Cypress.PluginConfigOptions);

      // act
      await handlers.get('after:spec')?.({ name: 'login.cy.ts', relative }, {});

      // assert
      expect(saveHar).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'login.cy.har', outDir: expected })
      );
    }
  );

  it('should start recording in the folder of the spec before it runs', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config);

    // act
    await handlers.get('before:spec')?.({
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });

    // assert
    expect(recordHar).toHaveBeenCalledWith({
      content: true,
      excludePaths: ['^\\/__(cypress[\\w-]*)?\\/'],
      rootDir: '/project/cypress/e2e'
    });
  });
});
