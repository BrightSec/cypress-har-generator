import type { NetworkRequest } from './NetworkRequest.ts';

export interface HarExporter {
  read(): Promise<string>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
