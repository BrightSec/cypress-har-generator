import { NetworkObserver } from './NetworkObserver.ts';
import { Logger } from '../utils/Logger.ts';
import { NetworkRequest } from './NetworkRequest.ts';
import { CompositeFilter } from './filters/index.ts';
import type { ObserverFactory } from './ObserverFactory.ts';
import type { NetworkObserverOptions } from './NetworkObserverOptions.ts';
import type { Observer } from './Observer.ts';
import type { Network } from './Network.ts';

export class DefaultObserverFactory implements ObserverFactory {
  private readonly defaultRequestFilter = new CompositeFilter();

  constructor(private readonly logger: Logger) {}

  public createNetworkObserver(
    network: Network,
    options: NetworkObserverOptions
  ): Observer<NetworkRequest> {
    return new NetworkObserver(
      options,
      network,
      this.logger,
      this.defaultRequestFilter
    );
  }
}
