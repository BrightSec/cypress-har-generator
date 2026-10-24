import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';

export class StatusCodeFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { excludeStatusCodes }: RequestFilterOptions
  ): boolean {
    return !excludeStatusCodes?.includes(request.statusCode);
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return (
      Array.isArray(options.excludeStatusCodes) &&
      options.excludeStatusCodes.length > 0
    );
  }
}
