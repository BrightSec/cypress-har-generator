import type { NetworkObserverOptions } from './NetworkObserverOptions.ts';
import type { Observer } from './Observer.ts';
import { NetworkRequest } from './NetworkRequest.ts';
import type { Network } from './Network.ts';

export interface ObserverFactory {
  createNetworkObserver(
    network: Network,
    options: NetworkObserverOptions
  ): Observer<NetworkRequest>;
}
