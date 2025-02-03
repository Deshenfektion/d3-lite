import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'd3lite',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    sourcemap: true,
    minify: false,
    rollupOptions: {
      output: {
        preserveModules: false,
      },
    },
  },
});
