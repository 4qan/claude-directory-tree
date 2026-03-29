import { describe, it, expect, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServer } from '../src/server/index.js';

async function makeTmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'ops-test-'));
}

describe('POST /api/operations/* (OPS-01 to OPS-09)', () => {
  const servers: Awaited<ReturnType<typeof createServer>>[] = [];
  const tmpDirs: string[] = [];

  afterEach(async () => {
    for (const s of servers) {
      await s.close().catch(() => {});
    }
    servers.length = 0;
    for (const d of tmpDirs) {
      await fs.rm(d, { recursive: true, force: true }).catch(() => {});
    }
    tmpDirs.length = 0;
    vi.restoreAllMocks();
  });

  async function makeServer() {
    const tmpDir = await makeTmpDir();
    tmpDirs.push(tmpDir);
    const server = await createServer(tmpDir);
    servers.push(server);
    return { server, tmpDir };
  }

  // --- POST /api/operations/open ---

  it('open: returns { success: true } for a valid path', async () => {
    const { server, tmpDir } = await makeServer();
    const filePath = path.join(tmpDir, 'test.md');
    await fs.writeFile(filePath, '# Test');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/open',
      payload: { path: filePath },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  // --- POST /api/operations/copy ---

  it('copy: creates file at destination, returns { success: true, destPath }', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    const destDir = path.join(tmpDir, 'dest-scope', 'commands');
    await fs.writeFile(srcFile, '# My Command');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.destPath).toBeDefined();
    // File should exist at destination
    await expect(fs.access(body.destPath)).resolves.toBeUndefined();
  });

  it('copy: returns { success: false, conflict: true } when dest exists and overwrite=false', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    const destDir = path.join(tmpDir, 'commands');
    const destFile = path.join(destDir, 'mycommand.md');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(srcFile, '# My Command');
    await fs.writeFile(destFile, '# Existing');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.conflict).toBe(true);
  });

  it('copy: overwrites when overwrite=true and dest exists', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    const destDir = path.join(tmpDir, 'commands');
    const destFile = path.join(destDir, 'mycommand.md');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(srcFile, '# Updated Command');
    await fs.writeFile(destFile, '# Old Command');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const content = await fs.readFile(destFile, 'utf-8');
    expect(content).toBe('# Updated Command');
  });

  it('copy: skill (directory type) copies entire directory recursively', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    // Skill: src is a file inside a skill directory
    const skillDir = path.join(srcDir, 'my-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill');
    await fs.writeFile(path.join(skillDir, 'rules.md'), '# Rules');
    const srcFile = path.join(skillDir, 'SKILL.md');
    const destDir = path.join(tmpDir, 'skills');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'skill',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // The entire skill directory should be copied
    const copiedDir = path.join(destDir, 'my-skill');
    await expect(fs.access(copiedDir)).resolves.toBeUndefined();
    await expect(fs.access(path.join(copiedDir, 'rules.md'))).resolves.toBeUndefined();
  });

  it('copy: hook type returns 400 with error about cannot be copied', async () => {
    const { server, tmpDir } = await makeServer();

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: '/some/settings.json#hookId',
        destinationDir: tmpDir,
        artifactType: 'hook',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/cannot be copied/i);
  });

  it('copy: .md file with @-includes returns warnings with type=reference', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    await fs.writeFile(
      srcFile,
      '# Command\n@/Users/test/some-file.md\nSome content here.'
    );
    const destDir = path.join(tmpDir, 'commands');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.warnings)).toBe(true);
    const refWarning = body.warnings.find((w: { type: string }) => w.type === 'reference');
    expect(refWarning).toBeDefined();
    expect(refWarning.message).toContain('@/Users/test/some-file.md');
  });

  it('copy: claude-md type returns semantic warning about different purposes', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'CLAUDE.md');
    await fs.writeFile(srcFile, '# Project Instructions');
    const destDir = path.join(tmpDir, '');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'claude-md',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const semanticWarning = body.warnings?.find((w: { type: string }) => w.type === 'semantic');
    expect(semanticWarning).toBeDefined();
    expect(semanticWarning.message).toContain('different purposes');
  });

  it('copy: plugin type returns state warning about enabled/disabled', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const pluginDir = path.join(srcDir, 'my-plugin');
    await fs.mkdir(pluginDir, { recursive: true });
    const srcFile = path.join(pluginDir, 'plugin.json');
    await fs.writeFile(srcFile, '{}');
    const destDir = path.join(tmpDir, 'plugins');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/copy',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'plugin',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const stateWarning = body.warnings?.find((w: { type: string }) => w.type === 'state');
    expect(stateWarning).toBeDefined();
    expect(stateWarning.message).toContain('enabled/disabled');
  });

  // --- POST /api/operations/move ---

  it('move: copies file to dest then removes source', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    const destDir = path.join(tmpDir, 'commands');
    await fs.writeFile(srcFile, '# Move Me');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/move',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Source should be gone
    await expect(fs.access(srcFile)).rejects.toThrow();
    // Dest should exist
    await expect(fs.access(body.destPath)).resolves.toBeUndefined();
  });

  it('move: removes source directory for directory-type artifacts', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const skillDir = path.join(srcDir, 'my-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Skill');
    const srcFile = path.join(skillDir, 'SKILL.md');
    const destDir = path.join(tmpDir, 'skills');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/move',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'skill',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Source directory should be gone
    await expect(fs.access(skillDir)).rejects.toThrow();
  });

  it('move: does NOT call fs.rename (EXDEV safety)', async () => {
    const { server, tmpDir } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    const destDir = path.join(tmpDir, 'commands');
    await fs.writeFile(srcFile, '# Move Me');

    const renameSpy = vi.spyOn(fs, 'rename');

    await server.inject({
      method: 'POST',
      url: '/api/operations/move',
      payload: {
        sourcePath: srcFile,
        destinationDir: destDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(renameSpy).not.toHaveBeenCalled();
  });

  // --- POST /api/operations/promote ---

  it('promote: copies artifact to homedir/.claude/{typeDir}/ and removes source', async () => {
    const { server } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    await fs.writeFile(srcFile, '# Promote Me');

    const expectedDestDir = path.join(os.homedir(), '.claude', 'commands');
    const expectedDest = path.join(expectedDestDir, 'mycommand.md');

    // Clean up any existing file from previous runs
    await fs.rm(expectedDest, { force: true }).catch(() => {});

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/promote',
      payload: {
        sourcePath: srcFile,
        artifactType: 'command',
        overwrite: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Source removed
    await expect(fs.access(srcFile)).rejects.toThrow();
    // Clean up dest
    await fs.rm(expectedDest, { force: true }).catch(() => {});
  });

  it('promote: blocked type returns 400', async () => {
    const { server } = await makeServer();

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/promote',
      payload: {
        sourcePath: '/some/settings.json#hookId',
        artifactType: 'hook',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  // --- POST /api/operations/demote ---

  it('demote: copies global artifact to project {typeDir}/ and removes source', async () => {
    const { server } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    // targetProjectDir simulates scope.rootPath which already points to the .claude directory
    const targetProjectDir = await makeTmpDir();
    tmpDirs.push(targetProjectDir);
    const srcFile = path.join(srcDir, 'mycommand.md');
    await fs.writeFile(srcFile, '# Demote Me');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/demote',
      payload: {
        sourcePath: srcFile,
        targetProjectDir,
        artifactType: 'command',
        overwrite: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Source removed
    await expect(fs.access(srcFile)).rejects.toThrow();
    // Dest exists in targetProjectDir/commands/ (no extra .claude nesting)
    const expectedDest = path.join(targetProjectDir, 'commands', 'mycommand.md');
    await expect(fs.access(expectedDest)).resolves.toBeUndefined();
  });

  // --- POST /api/operations/describe ---

  it('describe: returns frontmatter description if present', async () => {
    const { server } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const filePath = path.join(srcDir, 'artifact.md');
    await fs.writeFile(
      filePath,
      '---\ndescription: "Does something useful"\n---\n\n# Artifact\n\nSome content.'
    );

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/describe',
      payload: { path: filePath },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.description).toBe('Does something useful');
  });

  it('describe: returns first paragraph if no frontmatter description', async () => {
    const { server } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const filePath = path.join(srcDir, 'artifact.md');
    await fs.writeFile(
      filePath,
      '---\ntitle: "My Command"\n---\n\nThis is the first paragraph of the command.\n\nThis is the second paragraph.'
    );

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/describe',
      payload: { path: filePath },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.description).toBe('This is the first paragraph of the command.');
  });

  it('describe: returns null for files with no description and no content', async () => {
    const { server } = await makeServer();
    const srcDir = await makeTmpDir();
    tmpDirs.push(srcDir);
    const filePath = path.join(srcDir, 'empty.md');
    await fs.writeFile(filePath, '---\ntitle: "Empty"\n---\n');

    const res = await server.inject({
      method: 'POST',
      url: '/api/operations/describe',
      payload: { path: filePath },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.description).toBeNull();
  });
});
