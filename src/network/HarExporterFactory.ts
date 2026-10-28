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
  /**
   * Leaves out of each entry the values that change from one run to the next, so two HARs of the same spec can be diffed:
   * `startedDateTime` is `1970-01-01T00:00:00.000Z`, `time`, the timings and the times of WebSocket and server-sent event messages are `-1`,
   * and `connection` is removed. The entries keep their order by start time. It applies after `filter` and `transform`.
   * @defaultValue false
   */
  stable?: boolean;
}

export interface HarExporterFactory {
  create(options: HarExporterOptions): Promise<HarExporter>;
}
