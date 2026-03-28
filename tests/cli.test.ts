import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CLI build output', () => {
  it('dist/cli.js has shebang as first line (INFRA-01)', () => {
    const cliPath = resolve(__dirname, '..', 'dist', 'cli.js');
    const content = readFileSync(cliPath, 'utf-8');
    const firstLine = content.split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });
});
