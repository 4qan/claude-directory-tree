import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'client',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'client/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3737',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
