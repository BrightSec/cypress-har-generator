import type { Network } from '../network/index.ts';
import type { NetworkOptions } from './NetworkOptions.ts';

export interface Connection {
  open(): Promise<void>;

  close(): Promise<void>;

  discoverNetwork(options?: NetworkOptions): Network;
}
