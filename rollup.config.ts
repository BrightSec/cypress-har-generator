import { dts } from 'rollup-plugin-dts';
import type { RollupOptions } from 'rollup';

// Bundles the public types into one file, so consumers with `skipLibCheck: false` never type-check
// internal declarations, which import dev-only types and use `.ts` extensions that TypeScript 4 rejects
export default {
  input: 'dist/index.d.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: [/^node:/],
  plugins: [dts()]
} satisfies RollupOptions;
