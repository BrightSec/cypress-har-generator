import { NetworkRequest } from '../NetworkRequest.ts';
import { HostFilter } from './HostFilter.ts';
import { PathFilter } from './PathFilter.ts';
import { MimeFilter } from './MimeFilter.ts';
import { BlobFilter } from './BlobFilter.ts';
import { StatusCodeFilter } from './StatusCodeFilter.ts';
import type { RequestFilter, RequestFilterOptions } from './RequestFilter.ts';

export class CompositeFilter implements RequestFilter {
  constructor(
    private readonly children: RequestFilter[] = [
      new HostFilter(),
      new PathFilter(),
      new MimeFilter(),
      new BlobFilter(),
      new StatusCodeFilter()
    ]
  ) {}

  public apply(
    request: NetworkRequest,
    options: RequestFilterOptions
  ): boolean {
    return this.children
      .filter(x => x.wouldApply(options))
      .every(x => x.apply(request, options));
  }

  public wouldApply(options: RequestFilterOptions): boolean {
    return this.children.some(x => x.wouldApply(options));
  }
}
