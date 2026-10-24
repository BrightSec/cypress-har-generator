import type { NetworkRequest } from './NetworkRequest';

export interface HarExporter {
  read(): Promise<string>;

  write(networkRequest: NetworkRequest): Promise<void>;

  end(): void;
}
