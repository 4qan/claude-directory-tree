import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    outDir: 'dist',
    target: 'node20',
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: ['src/server/index.ts'],
    format: ['esm'],
    outDir: 'dist/server',
    target: 'node20',
    clean: false,
  },
]);
