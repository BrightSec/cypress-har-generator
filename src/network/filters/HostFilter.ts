import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';
import { HostPattern } from '../../utils/HostPattern.ts';

export class HostFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { includeHosts, excludeHosts }: RequestFilterOptions
  ): boolean {
    const { parsedURL } = request;
    const matches = (patterns: (string | RegExp)[] | undefined): boolean =>
      !!patterns?.some(pattern => HostPattern.test(pattern, parsedURL));

    return (
      !matches(excludeHosts) && (!includeHosts?.length || matches(includeHosts))
    );
  }

  public wouldApply({
    includeHosts,
    excludeHosts
  }: RequestFilterOptions): boolean {
    return [includeHosts, excludeHosts].some(
      patterns => Array.isArray(patterns) && patterns.length > 0
    );
  }
}
