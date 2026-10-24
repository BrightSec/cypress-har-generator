import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';

export class MimeFilter implements RequestFilter {
  public apply(
    request: NetworkRequest,
    { includeMimes }: RequestFilterOptions
  ): boolean {
    return !!(request.mimeType && includeMimes?.includes(request.mimeType));
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return (
      Array.isArray(options.includeMimes) && options.includeMimes.length > 0
    );
  }
}
