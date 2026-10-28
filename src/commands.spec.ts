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
  const intercept = jest.fn();

  beforeAll(async () => {
    Object.assign(globalThis, {
      Cypress: {
        spec: {
          name: 'spec.cy.ts',
          absolute: '/project/cypress/e2e/spec.cy.ts'
        },
        Commands: {
          add: (name: string, fn: Command) => commands.set(name, fn)
        }
      },
      cy: { task, intercept }
    });

    await import('./commands.ts');
  });

  beforeEach(() => {
    Object.assign(Cypress.spec, {
      absolute: '/project/cypress/e2e/spec.cy.ts'
    });
    task.mockReset();
    intercept.mockReset();
  });

  describe('recordHar', () => {
    it('should exclude the Cypress internal requests by default', () => {
      // act
      commands.get('recordHar')?.();

      // assert
      expect(task).toHaveBeenCalledWith(
        'recordHar',
        expect.objectContaining({
          excludePaths: ['^\\/__(cypress[\\w-]*)?\\/']
        })
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

  describe('replayHar', () => {
    const url = 'https://example.com/api';
    const entries = [
      {
        request: { method: 'GET', url },
        response: {
          status: 200,
          headers: [],
          content: { size: 2, mimeType: 'text/plain', text: 'ok' }
        }
      }
    ];

    const replay = (...args: unknown[]) => replayEntries(entries, ...args);

    const replayEntries = (result: unknown, ...args: unknown[]) => {
      task.mockReturnValue({
        then: (callback: (x: unknown) => unknown) => callback(result)
      });
      commands.get('replayHar')?.(...args);

      const [matcher, handler]: [unknown, (req: unknown) => void] =
        (intercept.mock.calls.at(-1) ?? []) as [
          unknown,
          (req: unknown) => void
        ];

      return { matcher, handler };
    };

    const createRequest = (requestUrl: string, resourceType = 'fetch') => ({
      method: 'GET',
      url: requestUrl,
      body: '',
      resourceType,
      reply: jest.fn(),
      destroy: jest.fn()
    });

    const twice = [
      { ...entries[0], response: { ...entries[0].response, status: 201 } },
      { ...entries[0], response: { ...entries[0].response, status: 202 } }
    ];

    it('should read the HAR file in the Node process', () => {
      // act
      replay('example.har');

      // assert
      expect(task).toHaveBeenCalledWith('readHar', 'example.har');
    });

    it('should read the HAR of the spec without a path', () => {
      // act
      replay();

      // assert
      expect(task).toHaveBeenCalledWith('replaySpecHar', {
        name: 'spec.cy.ts',
        absolute: '/project/cypress/e2e/spec.cy.ts'
      });
    });

    it('should take the options without a path', () => {
      // act
      const { matcher } = replay({ url: '**/api' });

      // assert
      expect(matcher).toEqual({ url: '**/api' });
    });

    it('should not intercept while the spec records its HAR', () => {
      // act
      replayEntries(null);

      // assert
      expect(intercept).not.toHaveBeenCalled();
    });

    it('should go on serving the HAR of the spec from where the previous test stopped', () => {
      // arrange
      Object.assign(Cypress.spec, {
        absolute: '/project/cypress/e2e/next.cy.ts'
      });
      const first = createRequest(url);
      const second = createRequest(url);

      // act
      replayEntries(twice).handler(first);
      replayEntries(twice).handler(second);

      // assert
      expect(first.reply).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 201 })
      );
      expect(second.reply).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 202 })
      );
    });

    it('should serve a HAR file from its first entry on each call', () => {
      // arrange
      const first = createRequest(url);
      const second = createRequest(url);

      // act
      replayEntries(twice, 'example.har').handler(first);
      replayEntries(twice, 'example.har').handler(second);

      // assert
      expect(first.reply).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 201 })
      );
      expect(second.reply).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 201 })
      );
    });

    it('should let a page reach the server', () => {
      // arrange
      const { handler } = replay('example.har');
      const req = createRequest(url, 'document');

      // act
      handler(req);

      // assert
      expect(req.reply).not.toHaveBeenCalled();
      expect(req.destroy).not.toHaveBeenCalled();
    });

    it('should intercept every request by default', () => {
      // act
      const { matcher } = replay('example.har');

      // assert
      expect(matcher).toEqual({ url: /.*/ });
    });

    it('should intercept the requests matching the given URL', () => {
      // act
      const { matcher } = replay('example.har', { url: '**/api' });

      // assert
      expect(matcher).toEqual({ url: '**/api' });
    });

    it('should reply with the recorded response', () => {
      // arrange
      const { handler } = replay('example.har');
      const req = createRequest(url);

      // act
      handler(req);

      // assert
      expect(req.reply).toHaveBeenCalledWith({
        statusCode: 200,
        headers: {},
        body: 'ok'
      });
    });

    it('should abort a request missing from the HAR by default', () => {
      // arrange
      const { handler } = replay('example.har');
      const req = createRequest('https://example.com/other');

      // act
      handler(req);

      // assert
      expect(req.destroy).toHaveBeenCalled();
      expect(req.reply).not.toHaveBeenCalled();
    });

    it('should pass on a request missing from the HAR with the fallback', () => {
      // arrange
      const { handler } = replay('example.har', { notFound: 'fallback' });
      const req = createRequest('https://example.com/other');

      // act
      handler(req);

      // assert
      expect(req.destroy).not.toHaveBeenCalled();
      expect(req.reply).not.toHaveBeenCalled();
    });

    it.each(['', 42, null])(
      'should throw a TypeError when the path is %p',
      path => {
        // act & assert
        expect(() => commands.get('replayHar')?.(path)).toThrow(TypeError);
        expect(task).not.toHaveBeenCalled();
      }
    );

    it.each([{ url: 42 }, { notFound: 'ignore' }])(
      'should throw a TypeError when the options are %p',
      options => {
        // act & assert
        expect(() =>
          commands.get('replayHar')?.('example.har', options)
        ).toThrow(TypeError);
        expect(task).not.toHaveBeenCalled();
      }
    );
  });
});
