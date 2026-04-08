import { describe, it, expect, vi } from 'vitest';
import { resolve } from 'node:path';
import { findClaudeDirs } from '../src/scanner/discover.js';
import { runScan, decodeProjectCacheName } from '../src/scanner/index.js';
import { ScanResponseSchema } from '../src/scanner/types.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = resolve(__dirname, '..', 'tests', 'fixtures');

describe('findClaudeDirs', () => {
  it('SCAN-01: finds .claude dirs in nested fixture (project-a and project-b)', async () => {
    const results = await findClaudeDirs(resolve(FIXTURES, 'nested'));
    expect(results).toHaveLength(2);
    const names = results.map((p) => path.basename(path.dirname(p)));
    expect(names).toContain('project-a');
    expect(names).toContain('project-b');
  });

  it('finds the single root .claude dir in fixtures', async () => {
    const results = await findClaudeDirs(FIXTURES);
    // should find root + nested project-a + project-b
    const dirs = results.map((p) => path.basename(path.dirname(p)));
    expect(dirs).toContain('fixtures');
    expect(dirs).toContain('project-a');
    expect(dirs).toContain('project-b');
  });

  it('skips node_modules directories', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'));
    try {
      await fs.mkdir(path.join(tmpDir, 'node_modules', 'some-pkg', '.claude'), { recursive: true });
      await fs.mkdir(path.join(tmpDir, 'src', '.claude'), { recursive: true });
      const results = await findClaudeDirs(tmpDir);
      const names = results.map((p) => path.dirname(p));
      expect(names.some((n) => n.includes('node_modules'))).toBe(false);
      expect(results).toHaveLength(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not recurse into .claude directories', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'));
    try {
      // .claude/.claude should NOT be found
      await fs.mkdir(path.join(tmpDir, '.claude', '.claude'), { recursive: true });
      const results = await findClaudeDirs(tmpDir);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(path.join(tmpDir, '.claude'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('silently skips unreadable directories (EACCES)', async () => {
    // We can't easily test EACCES in a portable way; just ensure function doesn't throw
    await expect(findClaudeDirs('/nonexistent/path')).resolves.toEqual([]);
  });

  it('INFRA-04: scanning 15 empty project dirs completes under 1000ms', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-perf-'));
    try {
      for (let i = 0; i < 15; i++) {
        await fs.mkdir(path.join(tmpDir, `project-${i}`, '.claude'), { recursive: true });
      }
      const start = Date.now();
      await findClaudeDirs(tmpDir);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('decodeProjectCacheName', () => {
  it('XPLAT-01: decodes Unix-encoded path', () => {
    vi.spyOn(os, 'platform').mockReturnValue('darwin');
    expect(decodeProjectCacheName('-Users-bob-proj')).toBe('/Users/bob/proj');
    vi.restoreAllMocks();
  });

  it('XPLAT-01: decodes Windows single-hyphen encoded path', () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32');
    expect(decodeProjectCacheName('C-Users-bob-proj')).toBe('C:\\Users\\bob\\proj');
    vi.restoreAllMocks();
  });

  it('XPLAT-01: decodes Windows double-hyphen encoded path', () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32');
    expect(decodeProjectCacheName('C--Users-bob-proj')).toBe('C:\\Users\\bob\\proj');
    vi.restoreAllMocks();
  });

  it('XPLAT-01: decodes Unix path without mock (default platform)', () => {
    // On any CI platform, a leading-hyphen name should give a Unix-style path
    const result = decodeProjectCacheName('-Users-bob-proj');
    expect(result).toBe('/Users/bob/proj');
  });
});

describe('runScan', () => {
  it('produces a ScanResponseSchema-valid response', async () => {
    const result = await runScan(FIXTURES);
    expect(() => ScanResponseSchema.parse(result)).not.toThrow();
  });

  it('SCAN-04: result has a non-zero totalArtifacts count for fixture dir', async () => {
    const result = await runScan(FIXTURES);
    expect(result.totalArtifacts).toBeGreaterThan(0);
  });

  it('targetDir matches the scanned directory', async () => {
    const result = await runScan(FIXTURES);
    expect(result.targetDir).toBe(FIXTURES);
  });

  it('scannedAt is a valid ISO string', async () => {
    const result = await runScan(FIXTURES);
    expect(() => new Date(result.scannedAt)).not.toThrow();
    expect(result.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
