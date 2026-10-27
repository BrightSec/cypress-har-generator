const HOST_NAME_PATTERN =
  /^(?:[a-z0-9_-]+(?:\.[a-z0-9_-]+)*|\[[0-9a-f:.]+\])(?::\d+)?$/i;
const PORT_PATTERN = /:\d+$/;

export class HostPattern {
  public static isHostName(pattern: string): boolean {
    return HOST_NAME_PATTERN.test(pattern);
  }

  public static test(
    pattern: string | RegExp,
    { host, hostname }: { host: string; hostname: string }
  ): boolean {
    if (typeof pattern !== 'string') {
      return pattern.test(host);
    }

    if (!this.isHostName(pattern)) {
      return new RegExp(pattern).test(host);
    }

    const expected = pattern.toLowerCase();

    return PORT_PATTERN.test(expected)
      ? expected === host
      : expected === hostname;
  }

  // A RegExp cannot be passed to `cy.task`, so it is sent as its source,
  // which is wrapped to keep it from being read as a host name.
  public static toSource(pattern: string | RegExp): string {
    return typeof pattern === 'string' ? pattern : `(?:${pattern.source})`;
  }
}
