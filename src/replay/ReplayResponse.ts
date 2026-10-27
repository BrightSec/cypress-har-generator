import type { Header, Response } from 'har-format';
import type { StaticResponse } from 'cypress/types/net-stubbing';

// the HAR keeps the decoded body, so the original framing and encoding of the body no longer apply,
// and the hop-by-hop headers belong to the recorded connection
const DROPPED_HEADERS: ReadonlySet<string> = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive'
]);

export class ReplayResponse {
  constructor(private readonly response: Response) {}

  public toStaticResponse(): StaticResponse {
    // HAR 1.2 records a request that got no response with the status 0
    if (!this.response.status) {
      return { forceNetworkError: true };
    }

    return {
      statusCode: this.response.status,
      headers: this.buildHeaders(this.response.headers ?? []),
      body: this.buildBody()
    };
  }

  private buildHeaders(headers: Header[]): Record<string, string> {
    const result: Record<string, string> = {};

    for (const { name, value } of headers) {
      const key = name.toLowerCase();

      if (DROPPED_HEADERS.has(key)) {
        continue;
      }

      // cy.intercept() takes one value per header, while several Set-Cookie headers cannot be
      // combined into one (RFC 9110, section 5.3), so only the first cookie is served
      if (!(key in result)) {
        result[key] = value;
      } else if (key !== 'set-cookie') {
        result[key] += `, ${value}`;
      }
    }

    return result;
  }

  private buildBody(): string | ArrayBuffer {
    const { text = '', encoding } = this.response.content ?? {};

    if (encoding !== 'base64') {
      return text;
    }

    return Uint8Array.from(atob(text), char => char.charCodeAt(0)).buffer;
  }
}
