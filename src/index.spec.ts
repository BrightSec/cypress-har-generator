import { enableExperimentalLifecycle } from './index.ts';
import { Plugin } from './Plugin.ts';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('enableExperimentalLifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should start recording in the folder of the spec before it runs', async () => {
    // arrange
    const recordHar = jest
      .spyOn(Plugin.prototype, 'recordHar')
      .mockResolvedValue(undefined);
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const on = ((event: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(event, handler)) as unknown as Cypress.PluginEvents;
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
