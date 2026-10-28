import type { NetworkRequest } from './NetworkRequest.ts';

export interface HarExporter {
  read(): Promise<AsyncIterable<string> | undefined>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
