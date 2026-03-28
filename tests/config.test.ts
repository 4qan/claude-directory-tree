import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getRegisteredProjects, addProject, removeProject } from '../src/config/projects.js';

// Use a temp directory for all tests to avoid touching real config
let tmpDir: string;

async function setupTmp(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
  return path.join(tmpDir, 'projects.json');
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe('getRegisteredProjects', () => {
  it('returns empty array when config file does not exist', async () => {
    const configFile = path.join(os.tmpdir(), 'nonexistent-' + Date.now(), 'projects.json');
    const result = await getRegisteredProjects(configFile);
    expect(result).toEqual([]);
  });
});

describe('addProject', () => {
  it('creates config file and returns path on subsequent read', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project', configFile);
    const projects = await getRegisteredProjects(configFile);
    expect(projects).toContain('/path/to/project');
  });

  it('does not create duplicates when called twice with same path', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project', configFile);
    await addProject('/path/to/project', configFile);
    const projects = await getRegisteredProjects(configFile);
    expect(projects.filter((p) => p === '/path/to/project')).toHaveLength(1);
  });

  it('stores multiple different paths', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project-a', configFile);
    await addProject('/path/to/project-b', configFile);
    const projects = await getRegisteredProjects(configFile);
    expect(projects).toContain('/path/to/project-a');
    expect(projects).toContain('/path/to/project-b');
    expect(projects).toHaveLength(2);
  });
});

describe('removeProject', () => {
  it('removes the specified path from the list', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project', configFile);
    await removeProject('/path/to/project', configFile);
    const projects = await getRegisteredProjects(configFile);
    expect(projects).not.toContain('/path/to/project');
  });

  it('is a no-op when path does not exist', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project', configFile);
    // removeProject a different path that was never added
    await expect(removeProject('/path/to/other', configFile)).resolves.toBeUndefined();
    const projects = await getRegisteredProjects(configFile);
    expect(projects).toHaveLength(1);
  });

  it('leaves remaining projects intact after removal', async () => {
    const configFile = await setupTmp();
    await addProject('/path/to/project-a', configFile);
    await addProject('/path/to/project-b', configFile);
    await removeProject('/path/to/project-a', configFile);
    const projects = await getRegisteredProjects(configFile);
    expect(projects).not.toContain('/path/to/project-a');
    expect(projects).toContain('/path/to/project-b');
  });
});
