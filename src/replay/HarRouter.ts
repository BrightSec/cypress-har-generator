import type { Entry } from 'har-format';

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
const SERVED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export class HarRouter {
  private readonly entries: readonly Entry[];
  private readonly served = new Set<Entry>();

  constructor(entries: readonly Entry[]) {
    this.entries = entries.filter(entry => this.isServed(entry));
  }

  public find({ method, url, body }: ReplayRequest): Entry | undefined {
    const requestUrl = this.normalizeUrl(url);
    const requestBody = this.normalizeBody(this.bodyToText(body));
    const matches = this.entries.filter(
      ({ request }) =>
        request.method.toUpperCase() === method.toUpperCase() &&
        this.normalizeUrl(request.url) === requestUrl &&
        this.normalizeBody(request.postData?.text ?? '') === requestBody
    );
    const entry = matches.find(x => !this.served.has(x)) ?? matches.at(-1);

    if (entry) {
      this.served.add(entry);
    }

    return entry;
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
