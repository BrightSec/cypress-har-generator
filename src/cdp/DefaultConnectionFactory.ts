import type {
  ConnectionFactory,
  ConnectionOptions
} from './ConnectionFactory.ts';
import { RetryStrategy } from './RetryStrategy.ts';
import type { Connection } from './Connection.ts';
import { CDPConnection } from './CDPConnection.ts';
import { Logger } from '../utils/Logger.ts';

export class DefaultConnectionFactory implements ConnectionFactory {
  constructor(private readonly logger: Logger) {}

  public create({
    maxRetries,
    initialBackoff,
    maximumBackoff,
    ...options
  }: ConnectionOptions): Connection {
    const retryStrategy = new RetryStrategy(
      maxRetries,
      initialBackoff,
      maximumBackoff
    );

    return new CDPConnection(options, this.logger, retryStrategy);
  }
}
