import { NetworkRequest } from '../NetworkRequest.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';

export class BlobFilter implements RequestFilter {
  public apply(request: NetworkRequest, _: RequestFilterOptions): boolean {
    return !request.isBlob();
  }

  public wouldApply({ includeBlobs }: RequestFilterOptions): boolean {
    return !(includeBlobs ?? true);
  }
}
