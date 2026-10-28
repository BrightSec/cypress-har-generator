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
        minimatch: (url: string, pattern: string) =>
          pattern === '**/other/**' ? url.includes('/other/') : false,
        Commands: {
          add: (name: string, fn: Command) => commands.set(name, fn)
        }
      },
      cy: { task, intercept, wrap: jest.fn() }
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
      const calls: number = intercept.mock.calls.length;
      commands.get('replayHar')?.(...args);

      type Route = [unknown, unknown];
      const routes: Route[] = intercept.mock.calls.slice(calls) as Route[];
      const isHandler = ([, x]: Route): boolean => typeof x === 'function';
      const [matcher, handler]: [unknown, (req: unknown) => void] =
        (routes.find(isHandler) ?? []) as [unknown, (req: unknown) => void];
      const staticRoutes: Route[] = routes.filter(x => !isHandler(x));

      return { matcher, handler, staticRoutes };
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
      expect(task).toHaveBeenCalledWith('readHar', 'example.har', {
        log: false
      });
    });

    it('should read the HAR of the spec without a path', () => {
      // act
      replay();

      // assert
      expect(task).toHaveBeenCalledWith(
        'replaySpecHar',
        { name: 'spec.cy.ts', absolute: '/project/cypress/e2e/spec.cy.ts' },
        { log: false }
      );
    });

    it('should take the options without a path', () => {
      // act
      const { matcher } = replay({ url: '**/api' });

      // assert
      expect(matcher).toEqual({ url: '**/api' });
    });

    it('should not intercept while the spec records its HAR', () => {
      // arrange
      Object.assign(Cypress.spec, {
        absolute: '/project/cypress/e2e/record.cy.ts'
      });

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

    it('should serve a GET that always got the same response with a static route left out of the Command Log', () => {
      // act
      const { staticRoutes } = replay('example.har');

      // assert
      expect(staticRoutes).toEqual([
        [
          { method: 'GET', url: /^https:\/\/example\.com\/api(#.*)?$/ },
          { statusCode: 200, headers: {}, body: 'ok', log: false }
        ]
      ]);
    });

    it.each([
      {
        name: 'a POST',
        entries: [
          {
            ...entries[0],
            request: { method: 'POST', url, postData: { text: '{}' } }
          }
        ]
      },
      { name: 'a GET with different responses', entries: twice },
      {
        name: 'a page',
        entries: [{ ...entries[0], _resourceType: 'Document' }]
      }
    ])('should serve $name through the function handler only', x => {
      // act
      const { staticRoutes } = replayEntries(x.entries, 'example.har');

      // assert
      expect(staticRoutes).toEqual([]);
    });

    it('should not add a static route outside the given URL', () => {
      // act
      const { staticRoutes } = replay('example.har', { url: '**/other/**' });

      // assert
      expect(staticRoutes).toEqual([]);
    });

    it('should not read the HAR of the spec again in the next test', () => {
      // arrange
      Object.assign(Cypress.spec, {
        absolute: '/project/cypress/e2e/cached.cy.ts'
      });
      replay();
      task.mockClear();

      // act
      const { handler } = replay();

      // assert
      expect(task).not.toHaveBeenCalled();
      expect(handler).toBeInstanceOf(Function);
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
