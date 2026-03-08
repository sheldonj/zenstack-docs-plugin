import { defineConfig } from 'tsup';

export default defineConfig({
  dts: true,
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  outDir: 'dist',
  sourcemap: false,
  splitting: false,
});
