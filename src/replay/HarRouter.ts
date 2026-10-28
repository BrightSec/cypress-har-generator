import type { Entry } from 'har-format';

export interface StaticRoute {
  method: string;
  url: string;
  entry: Entry;
}

export interface ReplayRequest {
  method: string;
  url: string;
  body?: unknown;
}

// cy.intercept() sees neither WebSocket frames nor the stream of a server-sent event,
// and a HAR keeps no body for an event stream
const UNSERVED_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'websocket',
  'eventsource'
]);
// the Fetch standard does not let these requests carry a body
const BODILESS_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);
const SERVED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

// the entries recorded for one request, served in order, then the last one again
interface Route {
  entries: Entry[];
  served: number;
}

export class HarRouter {
  private readonly routes = new Map<string, Route>();

  constructor(entries: readonly Entry[]) {
    for (const entry of entries) {
      if (!this.isServed(entry)) {
        continue;
      }

      const { method, url, postData } = entry.request;
      const key = this.keyOf(method, url, postData?.text ?? '');
      const route = this.routes.get(key);

      if (route) {
        route.entries.push(entry);
      } else {
        this.routes.set(key, { entries: [entry], served: 0 });
      }
    }
  }

  public find({ method, url, body }: ReplayRequest): Entry | undefined {
    const route = this.routes.get(
      this.keyOf(method, url, this.bodyToText(body))
    );

    if (!route) {
      return undefined;
    }

    const { entries } = route;

    return entries[Math.min(route.served++, entries.length - 1)];
  }

  /**
   * The `GET` and `HEAD` requests whose recorded entries all got the same response, so neither a body
   * nor the order they are served in decides which entry serves them.
   */
  public staticRoutes(): StaticRoute[] {
    const routes: StaticRoute[] = [];

    for (const { entries } of this.routes.values()) {
      const [entry]: Entry[] = entries;
      const { method, url } = entry.request;
      const response = JSON.stringify(this.servedPart(entry));

      if (
        BODILESS_METHODS.has(method.toUpperCase()) &&
        entries.every(x => JSON.stringify(this.servedPart(x)) === response)
      ) {
        routes.push({ method, url, entry });
      }
    }

    return routes;
  }

  private servedPart({ response }: Entry): unknown {
    return [
      response.status,
      response.headers,
      response.content?.text,
      response.content?.encoding
    ];
  }

  private keyOf(method: string, url: string, body: string): string {
    return JSON.stringify([
      method.toUpperCase(),
      this.normalizeUrl(url),
      this.normalizeBody(body)
    ]);
  }

  private isServed({ request, _resourceType }: Entry): boolean {
    const url = URL.parse(request?.url ?? '');

    return (
      !!url &&
      SERVED_PROTOCOLS.has(url.protocol) &&
      !UNSERVED_RESOURCE_TYPES.has(String(_resourceType ?? '').toLowerCase())
    );
  }

  private normalizeUrl(url: string): string | undefined {
    const parsed = URL.parse(url);

    if (parsed) {
      parsed.hash = '';
    }

    return parsed?.href;
  }

  private bodyToText(body: unknown): string {
    if (body === undefined || body === null) {
      return '';
    }

    if (typeof body === 'string') {
      return body;
    }

    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      return new TextDecoder().decode(body);
    }

    // cy.intercept() parses a JSON body into an object
    return JSON.stringify(body);
  }

  private normalizeBody(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  }
}
