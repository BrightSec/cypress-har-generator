import type { HarExporter } from './HarExporter.ts';

export interface HarExporterOptions {
  rootDir: string;
  filter?: string;
  transform?: string;
  /**
   * Keeps one entry for each request: the one that started first among those with the same method, URL and body.
   * It applies after `filter` and `transform`, and keeps every WebSocket and server-sent event entry with messages.
   * @defaultValue false
   */
  dedupe?: boolean;
}

export interface HarExporterFactory {
  create(options: HarExporterOptions): Promise<HarExporter>;
}
