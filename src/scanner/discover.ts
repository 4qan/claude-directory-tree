import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'vendor',
  'tests', '__tests__', 'test', 'spec',
]);

export async function findClaudeDirs(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // permission error or unreadable -- skip silently
    }
    const promises: Promise<void>[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === '.claude') {
        results.push(fullPath);
        continue; // don't recurse INTO .claude dirs
      }
      promises.push(walk(fullPath));
    }
    await Promise.all(promises);
  }

  await walk(rootDir);
  return results;
}
