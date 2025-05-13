import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const example = (name: string) =>
  fileURLToPath(new URL(`./examples/${name}/index.html`, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./examples', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('./dist-examples', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./examples/index.html', import.meta.url)),
        sales: example('sales-dashboard'),
        quality: example('quality-metrics'),
        timeseries: example('time-series'),
        explorer: example('explorer'),
      },
    },
  },
});
