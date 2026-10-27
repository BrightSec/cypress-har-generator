import { install } from './index.ts';
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
      includeBlobs: true,
      rootDir: '/project/cypress/e2e'
    });
  });
});
