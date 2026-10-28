import type {
  HarExporterFactory,
  HarExporterOptions
} from './HarExporterFactory.ts';
import type { HarExporter } from './HarExporter.ts';
import { DefaultHarExporter } from './DefaultHarExporter.ts';
import { Loader } from '../utils/Loader.ts';
import type { FileManager } from '../utils/FileManager.ts';
import type { Logger } from '../utils/Logger.ts';
import type {
  DefaultHarExporterOptions,
  Filter,
  Transformer
} from './DefaultHarExporterOptions.ts';
import { resolve } from 'node:path';

export class DefaultHarExporterFactory implements HarExporterFactory {
  constructor(
    private readonly fileManager: FileManager,
    private readonly logger: Logger
  ) {}

  public async create(options: HarExporterOptions): Promise<HarExporter> {
    const settings = await this.createSettings(options);
    const file = await this.fileManager.createTmpFile();

    return new DefaultHarExporter(this.logger, file, settings);
  }

  private async createSettings({
    filter,
    transform,
    rootDir,
    dedupe
  }: HarExporterOptions) {
    if (dedupe !== undefined && typeof dedupe !== 'boolean') {
      throw new TypeError('The `dedupe` option must be a boolean.');
    }

    const [preProcessor, postProcessor]: (Filter | Transformer | undefined)[] =
      await Promise.all(
        [filter, transform].map(path => this.loadCustomProcessor(path, rootDir))
      );

    return {
      filter: preProcessor,
      transform: postProcessor,
      transformPath: transform,
      dedupe
    } as DefaultHarExporterOptions;
  }

  private async loadCustomProcessor<T extends Filter | Transformer>(
    path: string | undefined,
    rootDir: string
  ): Promise<T | undefined> {
    let processor: T | undefined;

    if (path) {
      const absolutePath = resolve(rootDir, path);
      processor = await Loader.load(absolutePath);
    }

    return processor;
  }
}
