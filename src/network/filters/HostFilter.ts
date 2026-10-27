import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';
import { HostPattern } from '../../utils/HostPattern.ts';

export class HostFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { includeHosts }: RequestFilterOptions
  ): boolean {
    const { parsedURL } = request;

    return !!includeHosts?.some(pattern =>
      HostPattern.test(pattern, parsedURL)
    );
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return (
      Array.isArray(options.includeHosts) && options.includeHosts.length > 0
    );
  }
}
