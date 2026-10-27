import { enableExperimentalLifecycle, install } from './index.ts';
import { Plugin } from './Plugin.ts';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const createEvents = () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const on = ((event: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(event, handler)) as unknown as Cypress.PluginEvents;

  return { handlers, on };
};

describe('install', () => {
  const config = {
    isTextTerminal: true,
    env: {}
  } as unknown as Cypress.PluginConfigOptions;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should save a HAR for each spec by default', async () => {
    // arrange
    const saveHar = jest
      .spyOn(Plugin.prototype, 'saveHar')
      .mockResolvedValue(undefined);
    const { handlers, on } = createEvents();
    install(on, config);

    // act
    await handlers.get('after:spec')?.({ name: 'e2e/spec.cy.ts' }, {});

    // assert
    expect(saveHar).toHaveBeenCalledWith({
      fileName: 'spec.cy.har',
      outDir: '.'
    });
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
});

describe('enableExperimentalLifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
