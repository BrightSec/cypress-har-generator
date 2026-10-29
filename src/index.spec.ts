import { install } from './index.ts';
import { Plugin } from './Plugin.ts';
import { Logger } from './utils/Logger.ts';
import { HarReader } from './replay/HarReader.ts';
import { FileManager } from './utils/FileManager.ts';
import { DEFAULT_EXCLUDE_PATHS } from './constants.ts';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { join, resolve } from 'node:path';

const createEvents = () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const on = ((event: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(event, handler)) as unknown as Cypress.PluginEvents;

  return { handlers, on };
};

describe('install', () => {
  const projectRoot = resolve('/project');
  const config = {
    projectRoot,
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
      {
        name: 'spec.cy.ts',
        absolute: join(projectRoot, 'cypress/e2e/spec.cy.ts')
      },
      {}
    );

    // assert
    expect(saveHar).toHaveBeenCalledWith({
      waitForIdle: true,
      minIdleDuration: 200,
      maxWaitDuration: 3000,
      fileName: 'spec.cy.har',
      outDir: '.',
      stateOf: expect.any(Function)
    });
  });

  it('should list each test with the state Cypress reports for its try', async () => {
    // arrange
    const saveHar = jest
      .spyOn(Plugin.prototype, 'saveHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config);

    // act
    await handlers.get('after:spec')?.(
      {
        name: 'spec.cy.ts',
        absolute: join(projectRoot, 'cypress/e2e/spec.cy.ts')
      },
      {
        tests: [
          {
            title: ['suite', 'flaky'],
            state: 'passed',
            attempts: [{ state: 'failed' }, { state: 'passed' }]
          }
        ]
      }
    );

    // assert
    const { stateOf, keep } = saveHar.mock.calls[0]?.[0] ?? {};
    expect(
      [1, 2].map(attempt =>
        stateOf?.({ titlePath: ['suite', 'flaky'], attempt })
      )
    ).toEqual(['failed', 'passed']);
    expect(keep).toBeUndefined();
  });

  it('should list no states when Cypress reports no results, as in cypress open', async () => {
    // arrange
    const saveHar = jest
      .spyOn(Plugin.prototype, 'saveHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config);

    // act
    await handlers.get('after:spec')?.(
      {
        name: 'spec.cy.ts',
        absolute: join(projectRoot, 'cypress/e2e/spec.cy.ts')
      },
      undefined
    );

    // assert
    expect(saveHar.mock.calls[0]?.[0]).not.toHaveProperty('stateOf');
  });

  describe('failedTestsOnly', () => {
    const spec = {
      name: 'spec.cy.ts',
      absolute: join(projectRoot, 'cypress/e2e/spec.cy.ts')
    };

    it('should keep only the entries of the failed tries when it is set', async () => {
      // arrange
      const saveHar = jest
        .spyOn(Plugin.prototype, 'saveHar')
        .mockResolvedValue(undefined);
      const { handlers, on } = createEvents();
      install(on, config, { failedTestsOnly: true });

      // act
      await handlers.get('after:spec')?.(spec, {
        tests: [
          {
            title: ['suite', 'flaky'],
            state: 'passed',
            attempts: [{ state: 'failed' }, { state: 'passed' }]
          }
        ]
      });

      // assert
      const keep = saveHar.mock.calls[0]?.[0].keep;
      expect(
        [1, 2].map(attempt =>
          keep?.({ titlePath: ['suite', 'flaky'], attempt })
        )
      ).toEqual([true, false]);
    });

    it('should keep every entry when Cypress reports no results, as in cypress open', async () => {
      // arrange
      const saveHar = jest
        .spyOn(Plugin.prototype, 'saveHar')
        .mockResolvedValue(undefined);
      const { handlers, on } = createEvents();
      install(on, config, { failedTestsOnly: true });

      // act
      await handlers.get('after:spec')?.(spec, undefined);

      // assert
      expect(saveHar.mock.calls[0]?.[0]).not.toHaveProperty('keep');
    });

    it.each([{ input: null }, { input: 1 }, { input: 'true' }])(
      'should throw a TypeError when it is $input',
      ({ input }) => {
        // arrange
        const { on } = createEvents();

        // act & assert
        expect(() =>
          install(on, config, { failedTestsOnly: input as unknown as boolean })
        ).toThrow(TypeError);
      }
    );
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
      excludePaths: [...DEFAULT_EXCLUDE_PATHS],
      rootDir: '/project/cypress/e2e',
      includeHosts: ['api.example.com', 'localhost:8080'],
      excludeHosts: ['analytics.example.com']
    });
  });

  it('should throw when the host of the base URL is asked for without the base URL', () => {
    // arrange
    const { on } = createEvents();

    // act & assert
    expect(() => install(on, config, { includeBaseUrlHost: true })).toThrow(
      TypeError
    );
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
        {
          name: 'spec.cy.ts',
          absolute: join(projectRoot, 'cypress/e2e/spec.cy.ts')
        },
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
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: './cypress/e2e/**/*.cy.{js,ts}',
      spec: 'cypress/e2e/a/b/login.cy.ts',
      expected: join('hars', 'a', 'b')
    },
    {
      specPattern: ['src/**/*.cy.ts', 'cypress/**/*.cy.ts', 'cypress/e2e/**'],
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: '**/*.cy.ts',
      spec: 'src/a/login.cy.ts',
      expected: join('hars', 'src', 'a')
    },
    {
      specPattern: 'cypress/e2e/a/login.cy.ts',
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: 'hars'
    },
    {
      specPattern: join(projectRoot, 'cypress/e2e/**/*.cy.ts'),
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: 'cypress/e\\*2e/**/*.cy.ts',
      spec: 'cypress/e*2e/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: ['!cypress/e2e/a/**', 'cypress/**/*.cy.ts'],
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: join('hars', 'e2e', 'a')
    },
    {
      specPattern: 'cypress/e2e/**/*.cy.ts',
      spec: '../other/a/login.cy.ts',
      expected: 'hars'
    },
    {
      specPattern: '../shared/**/*.cy.ts',
      spec: '../shared/a/login.cy.ts',
      expected: join('hars', 'a')
    },
    {
      specPattern: undefined,
      spec: 'cypress/e2e/a/login.cy.ts',
      expected: 'hars'
    }
  ])(
    'should save the HAR of $spec to $expected when the spec pattern is $specPattern',
    async ({ specPattern, spec, expected }) => {
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
      await handlers.get('after:spec')?.(
        { name: 'login.cy.ts', absolute: resolve(projectRoot, spec) },
        {}
      );

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

  it('should read the HAR to replay relative to the project root', async () => {
    // arrange
    const entries = [{ request: { url: 'https://example.com/' } }];
    const read = jest
      .spyOn(HarReader.prototype, 'read')
      .mockResolvedValue(entries as never);
    const { handlers, on } = createEvents();
    install(on, config);
    const tasks = handlers.get('task') as unknown as Record<
      string,
      (path: string) => Promise<unknown>
    >;

    // act
    const result = await tasks.readHar('hars/example.har');

    // assert
    expect(read).toHaveBeenCalledWith(join(projectRoot, 'hars/example.har'));
    expect(result).toBe(entries);
  });

  describe('replaySpecHar', () => {
    const spec = {
      name: 'login.cy.ts',
      absolute: join(projectRoot, 'cypress/e2e/a/login.cy.ts')
    };
    const entries = [{ request: { url: 'https://example.com/' } }];

    const setup = ({
      exists,
      expose = {},
      ...rest
    }: {
      exists: boolean;
      expose?: Record<string, string>;
      lifecycle?: boolean;
      isTextTerminal?: boolean;
    }) => {
      jest.spyOn(FileManager.prototype, 'pathExists').mockResolvedValue(exists);
      const read = jest
        .spyOn(HarReader.prototype, 'read')
        .mockResolvedValue(entries as never);
      const saveHar = jest
        .spyOn(Plugin.prototype, 'saveHar')
        .mockResolvedValue(undefined);
      const disposeOfHar = jest
        .spyOn(Plugin.prototype, 'disposeOfHar')
        .mockResolvedValue(undefined);
      const { handlers, on } = createEvents();
      install(
        on,
        {
          ...config,
          isTextTerminal: rest.isTextTerminal ?? true,
          expose: { hars_folder: 'hars', ...expose }
        } as Cypress.PluginConfigOptions,
        { lifecycle: rest.lifecycle ?? true }
      );
      const tasks = handlers.get('task') as unknown as Record<
        string,
        (x: unknown) => Promise<unknown>
      >;
      const afterSpec = () => handlers.get('after:spec')?.(spec, {});

      return { tasks, read, saveHar, disposeOfHar, afterSpec };
    };

    it('should replay the HAR of the spec from its folder in hars_folder', async () => {
      // arrange
      const { tasks, read } = setup({ exists: true });

      // act
      const result = await tasks.replaySpecHar(spec);

      // assert
      expect(read).toHaveBeenCalledWith(
        join(projectRoot, 'hars', 'a', 'login.cy.har')
      );
      expect(result).toBe(entries);
    });

    it('should not overwrite the replayed HAR of the spec', async () => {
      // arrange
      const { tasks, saveHar, disposeOfHar, afterSpec } = setup({
        exists: true
      });
      await tasks.replaySpecHar(spec);

      // act
      await afterSpec();

      // assert
      expect(saveHar).not.toHaveBeenCalled();
      expect(disposeOfHar).toHaveBeenCalled();
    });

    it('should let the spec record its missing HAR', async () => {
      // arrange
      const { tasks, read, saveHar, afterSpec } = setup({ exists: false });

      // act
      const result = await tasks.replaySpecHar(spec);
      await afterSpec();

      // assert
      expect(result).toBeNull();
      expect(read).not.toHaveBeenCalled();
      expect(saveHar).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'login.cy.har',
          outDir: join('hars', 'a')
        })
      );
    });

    it('should record the HAR of the spec again when hars_update is all', async () => {
      // arrange
      const { tasks, read } = setup({
        exists: true,
        expose: { hars_update: 'all' }
      });

      // act
      const result = await tasks.replaySpecHar(spec);

      // assert
      expect(result).toBeNull();
      expect(read).not.toHaveBeenCalled();
    });

    it('should fail without the HAR of the spec when hars_update is none', async () => {
      // arrange
      const { tasks } = setup({
        exists: false,
        expose: { hars_update: 'none' }
      });

      // act & assert
      await expect(tasks.replaySpecHar(spec)).rejects.toThrow(
        /no HAR to replay/
      );
    });

    it.each([
      { lifecycle: false, isTextTerminal: true },
      { lifecycle: true, isTextTerminal: false }
    ])(
      'should fail without the HAR of the spec when the spec cannot record it (%p)',
      async options => {
        // arrange
        const { tasks } = setup({ exists: false, ...options });

        // act & assert
        await expect(tasks.replaySpecHar(spec)).rejects.toThrow(
          /no HAR to replay/
        );
      }
    );

    it('should throw on an unknown hars_update', () => {
      // arrange
      const { on } = createEvents();

      // act & assert
      expect(() =>
        install(on, {
          ...config,
          expose: { hars_update: 'new' }
        } as Cypress.PluginConfigOptions)
      ).toThrow(TypeError);
    });
  });
});
