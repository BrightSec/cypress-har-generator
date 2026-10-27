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
