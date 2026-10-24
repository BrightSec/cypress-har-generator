import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';
import { StringUtils } from '../../utils/StringUtils.ts';

export class PathFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { excludePaths }: RequestFilterOptions
  ): boolean {
    const { pathname = '/' } = request.parsedURL;

    return !excludePaths?.some(pattern =>
      StringUtils.toRegex(pattern).test(pathname)
    );
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return (
      Array.isArray(options.excludePaths) && options.excludePaths.length > 0
    );
  }
}
