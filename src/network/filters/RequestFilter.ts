import { NetworkRequest } from '../NetworkRequest.ts';
import type { NetworkObserverOptions } from '../NetworkObserverOptions.ts';

export type RequestFilterOptions = Omit<NetworkObserverOptions, 'content'>;

export interface RequestFilter {
  wouldApply(options: RequestFilterOptions): boolean;
  apply(request: NetworkRequest, options: RequestFilterOptions): boolean;
}
