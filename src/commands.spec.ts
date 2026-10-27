import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';

type Command = (...args: unknown[]) => unknown;

describe('commands', () => {
  const commands = new Map<string, Command>();
  const task = jest.fn();

  beforeAll(async () => {
    Object.assign(globalThis, {
      Cypress: {
        spec: { absolute: '/project/cypress/e2e/spec.cy.ts' },
        Commands: {
          add: (name: string, fn: Command) => commands.set(name, fn)
        }
      },
      cy: { task }
    });

    await import('./commands.ts');
  });

  beforeEach(() => {
    task.mockReset();
  });

  describe('recordHar', () => {
    it('should exclude the Cypress internal requests by default', () => {
      // act
      commands.get('recordHar')?.();

      // assert
      expect(task).toHaveBeenCalledWith(
        'recordHar',
        expect.objectContaining({ excludePaths: ['^\\/__cypress\\/'] })
      );
    });

    it('should replace the default excluded paths with the given ones', () => {
      // act
      commands.get('recordHar')?.({ excludePaths: [/^\/login/] });

      // assert
      expect(task).toHaveBeenCalledWith(
        'recordHar',
        expect.objectContaining({ excludePaths: ['^\\/login'] })
      );
    });

    it('should record the Cypress internal requests when the excluded paths are empty', () => {
      // act
      commands.get('recordHar')?.({ excludePaths: [] });

      // assert
      expect(task).toHaveBeenCalledWith(
        'recordHar',
        expect.objectContaining({ excludePaths: [] })
      );
    });
  });
});
