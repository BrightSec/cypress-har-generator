import type { HarExporter } from './HarExporter.ts';

export interface HarExporterOptions {
  rootDir: string;
  filter?: string;
  transform?: string;
}

export interface HarExporterFactory {
  create(options: HarExporterOptions): Promise<HarExporter>;
}
