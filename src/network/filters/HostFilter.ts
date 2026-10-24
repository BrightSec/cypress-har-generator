import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';
import { StringUtils } from '../../utils/StringUtils.ts';

export class HostFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { includeHosts }: RequestFilterOptions
  ): boolean {
    const { host } = request.parsedURL;

    return !!includeHosts?.some(pattern =>
      StringUtils.toRegex(pattern).test(host)
    );
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return (
      Array.isArray(options.includeHosts) && options.includeHosts.length > 0
    );
  }
}
