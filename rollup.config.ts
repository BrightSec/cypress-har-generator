import { dts } from 'rollup-plugin-dts';
import type { RollupOptions } from 'rollup';

// Bundles the public types into one file without imports of internal declarations, whose `.ts` extensions
// TypeScript 4 cannot resolve, which turns the option types into `any`
export default {
  input: 'dist/index.d.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: [/^node:/],
  plugins: [dts()]
} satisfies RollupOptions;
