import { Entry } from 'har-format';

describe('Record HAR', () => {
  beforeEach(() => cy.visit('/'));

  it('excludes a request by mime type', () => {
    cy.recordHar({ includeMimes: ['application/json'] });

    cy.get('a[href$=fetch]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('all.contain.something.like', {
        response: {
          content: { mimeType: 'application/json' }
        }
      });
  });

  // ADHOC: Cypress will automatically attach this header at the network proxy level, outside of the browser.
  // Therefore you will not see this header in the Dev Tools and the resulting HAR.
  // For details please refer to the notice at https://docs.cypress.io/api/commands/visit#Add-basic-auth-headers
  it.skip('records headers added by the proxy', () => {
    cy.recordHar();

    cy.visit('/', { auth: { password: 'admin', username: 'admin' } });

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should((data: Entry[]) => {
        const expected = data.find(({ request }: Entry) => request.url === '/');
        const headers = expected?.request.headers ?? [];
        expect(headers).to.contain.something.like({
          name: 'authorization',
          value: /.+/
        });
      });
  });

  // ADHOC: cy.request() sends requests to actual endpoints, bypassing the interceptor
  // For details please refer to the documentation at
  // https://docs.cypress.io/api/commands/request#cyrequest-sends-requests-to-actual-endpoints-bypassing-those-defined-using-cyintercept
  it.skip('records a request made by Cypress (not the tested app)', () => {
    cy.recordHar();

    cy.request('/api/products');

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /\/api\/products$/
        }
      });
  });

  it('records a large response body greater than 100MB', () => {
    cy.recordHar({
      maxTotalBufferSize: 256 * 1024 ** 2,
      maxResourceBufferSize: 256 * 1024 ** 2
    });

    cy.get('a[href$=large-content]').click();

    // ADHOC: downloading 150MB through the Cypress proxy takes 4-8s on a CI runner and sometimes over 20s,
    // so wait for the page to receive it, leaving `maxWaitDuration` only for the plugin to fetch and save the body
    cy.get('#result', { timeout: 60000 }).should(
      'have.text',
      'Found 1000 keys'
    );

    cy.saveHar({
      waitForIdle: true,
      maxWaitDuration: 20000
    });

    // ADHOC: due to the large size of the resulting HAR, we cannot use the `cy.findHar` command
    cy.match(
      /(\/api\/keys)(\n|.)*?("size":\s*150019900)(\n|.)*?("text":\s*"(?!Request content was evicted from inspector cache"))/
    ).should('be.true');
  });

  // ADHOC: .mjs files are excluded as Cypress forces ts-node to use the 'commonjs' module format. Covered by unit tests.
  // For details please refer to https://github.com/cypress-io/cypress/blob/e6b2466f7b219a86da46c1ac720432ef75193ca4/packages/server/lib/plugins/child/ts_node.js#L25
  ['.js', '.ts', '.cjs'].forEach(ext =>
    it(`excludes a request using the custom filter from ${ext} file`, () => {
      cy.recordHar({ filter: `../fixtures/filter${ext}` });

      cy.get('a[href$=fetch]').click();

      cy.saveHar({ waitForIdle: true });

      cy.findHar()
        .its('log.entries')
        .should('not.contain.something.like', {
          response: {
            content: { text: /\{"products":\[/ }
          }
        });
    })
  );

  ['.js', '.ts', '.cjs'].forEach(ext =>
    it(`transforms a request using the custom postprocessor from ${ext} file`, () => {
      cy.recordHar({ transform: `../fixtures/transform${ext}` });

      cy.get('a[href$=fetch]').click();

      cy.saveHar({ waitForIdle: true });

      cy.findHar()
        .its('log.entries')
        .should('contain.something.like', {
          response: {
            content: { text: /\{"items":\[/ }
          }
        });
    })
  );

  it('excludes a request by its path', () => {
    cy.recordHar({ excludePaths: [/^\/api\/products$/, '^\\/api\\/users$'] });

    cy.get('a[href$=fetch]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('not.contain.something.like', {
        request: {
          url: /^\/api\/products$/
        }
      });
  });

  it('excludes a request by the status code', () => {
    cy.recordHar({ excludeStatusCodes: [500] });

    cy.visit('/pages/unknown', { failOnStatusCode: false });

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('not.contain.something.like', {
        response: {
          status: 500
        }
      });
  });

  it('includes only a request when it host matches', () => {
    cy.recordHar({ includeHosts: ['www.openstreetmap.org'] });

    cy.get('a[href$=frame]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('all.contain.something.like', {
        request: {
          url: /www\.openstreetmap\.org/
        }
      });
  });

  it('includes only a request responding with the status code equal or greater than the threshold', () => {
    cy.recordHar({ minStatusCodeToInclude: 400 });

    cy.visit('/pages/unknown', { failOnStatusCode: false });

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('all.contain.something.like', {
        response: {
          status: 500
        }
      });
  });

  it('records a response body', () => {
    cy.recordHar();

    cy.get('a[href$=fetch]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        response: {
          content: { text: /\{"products":\[/ }
        }
      });
  });

  it('includes blobs loaded by the Service Worker', () => {
    cy.recordHar();

    cy.get('a[href$=service-worker]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /^blob:/
        }
      });
  });

  it('does not hold up a service worker while it starts', () => {
    cy.recordHar();

    cy.window().then(async win => {
      const registration = await win.navigator.serviceWorker.register(
        '/sw.js?registration',
        { scope: '/pages/registration' }
      );

      await registration.unregister();
    });
  });

  it('records each request of a service worker once', () => {
    cy.recordHar();

    cy.get('a[href$=service-worker]').click();
    cy.reload();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .then((entries: Entry[]) => {
        const keys = entries.map(
          ({ request, startedDateTime }: Entry) =>
            `${request.method} ${request.url} ${startedDateTime}`
        );

        expect(keys).to.have.length(new Set(keys).size);
      });
  });

  it('records an open request of a terminated worker', () => {
    cy.recordHar();

    cy.window().then(win => {
      const url = `${win.location.origin}/api/events?from=worker`;
      const src = win.URL.createObjectURL(
        new win.Blob([`fetch('${url}')`], { type: 'text/javascript' })
      );
      const worker = new win.Worker(src);

      return new Cypress.Promise<void>(resolve =>
        win.setTimeout(() => {
          worker.terminate();
          resolve();
        }, 1000)
      );
    });

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /\/api\/events\?from=worker$/
        }
      });
  });

  it('records the Server-Sent Events', () => {
    cy.recordHar();

    cy.get('a[href$=server-sent-events]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 2);
    cy.get('button').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        _resourceType: 'EventSource',
        response: {
          content: {
            mimeType: 'text/event-stream'
          }
        }
      })
      .and((data: Entry[]) => {
        const expected = data.find(
          ({ _eventSourceMessages }: Entry) =>
            (_eventSourceMessages as unknown[]).length > 0
        );
        const eventSourceMessages = expected?._eventSourceMessages;
        expect(eventSourceMessages).to.contain.something.like({
          eventName: 'message',
          data: /^This is a message at time/
        });
      });
  });

  it('records the WebSocket frames', () => {
    cy.recordHar();

    cy.get('a[href$=websocket]').click();
    cy.get('ul > li', { timeout: 300 }).should('have.length.gte', 2);
    cy.get('button').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /\/ws$/
        },
        response: {
          status: 101
        }
      })
      .and((data: Entry[]) => {
        const expected = data.find(
          ({ _webSocketMessages }: Entry) =>
            (_webSocketMessages as unknown[]).length > 0
        );
        const webSocketMessages = expected?._webSocketMessages;
        expect(webSocketMessages).to.contain.something.like({
          type: 'response',
          data: /^This is a message at time/
        });
        expect(webSocketMessages).to.contain.something.like({
          type: 'request',
          data: 'Hello Server!'
        });
      });
  });

  it('records the WebSocket frames when the socket is still open', () => {
    cy.recordHar();

    cy.get('a[href$=websocket]').click();
    cy.get('ul > li').should('have.length.gte', 2);

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should((data: Entry[]) => {
        const expected = data.find(
          ({ request, response }: Entry) =>
            request.url.endsWith('/ws') && response.status === 101
        );
        expect(expected).to.have.property('_resourceType', 'WebSocket');
        const webSocketMessages = expected?._webSocketMessages;
        expect(webSocketMessages).to.contain.something.like({
          type: 'response',
          data: /^This is a message at time/
        });
        expect(webSocketMessages).to.contain.something.like({
          type: 'request',
          data: 'Hello Server!'
        });
      });
  });

  it('records requests from the Shared Worker', () => {
    cy.recordHar();

    cy.get('a[href="pages/worker"]').click();

    cy.get('#number1').type('2');
    cy.get('#number2').type('4');
    cy.get('#sum-shared-worker').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /math$/,
          postData: {
            mimeType: 'application/json',
            text: /"op":"sum"/
          }
        }
      });
  });

  it('records requests from the Web Worker', () => {
    cy.recordHar();

    cy.get('a[href="pages/worker"]').click();

    cy.get('#number1').type('2');
    cy.get('#number2').type('4');
    cy.get('#sum-web-worker').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /math$/,
          postData: {
            mimeType: 'application/json',
            text: /"op":"sum"/
          }
        }
      });
  });

  it('excludes blobs loaded by the Service Worker', () => {
    cy.recordHar({ includeBlobs: false });

    cy.get('a[href$=service-worker]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('not.contain.something.like', {
        request: {
          url: /^blob:/
        }
      });
  });

  it('skips loading a response body', () => {
    cy.recordHar({ content: false });

    cy.get('a[href$=fetch]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('not.contain.something.like', {
        response: {
          content: { text: /\{"products":\[/, mimeType: 'application/json' }
        }
      });
  });

  it('records a text request body', () => {
    cy.recordHar({ content: false });

    cy.get('a[href$=post-data]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /api\/echo$/,
          postData: {
            text: /^\{"name":"/
          }
        }
      });
  });

  it('records a blob request body', () => {
    cy.recordHar({ content: false });

    cy.get('a[href$=post-data]').click();

    cy.saveHar({ waitForIdle: true });

    cy.findHar()
      .its('log.entries')
      .should('contain.something.like', {
        request: {
          url: /api\/echo$/,
          postData: {
            text: /^<html xmlns/
          }
        }
      });
  });
});
