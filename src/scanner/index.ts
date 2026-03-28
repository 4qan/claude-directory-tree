import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { findClaudeDirs } from './discover.js';
import { classifyScope, isGlobalScope } from './classify.js';
import { getRegisteredProjects } from '../config/projects.js';
import type { ScanResponse, ScopeNode } from './types.js';

export async function runScan(targetDir: string): Promise<ScanResponse> {
  // 1. Discover .claude dirs under targetDir
  const discoveredDirs = await findClaudeDirs(targetDir);

  // 2. Add manually registered project .claude dirs
  const registeredProjects = await getRegisteredProjects();
  for (const projectPath of registeredProjects) {
    const claudeDir = path.join(projectPath, '.claude');
    try {
      await fs.access(claudeDir);
      discoveredDirs.push(claudeDir);
    } catch {
      // path doesn't exist -- skip
    }
  }

  // 3. Deduplicate
  const seen = new Set<string>();
  const allClaudeDirs: string[] = [];
  for (const dir of discoveredDirs) {
    const abs = path.resolve(dir);
    if (!seen.has(abs)) {
      seen.add(abs);
      allClaudeDirs.push(abs);
    }
  }

  // 4. Check for global ~/.claude and prepend if not already included
  const globalDir = path.join(homedir(), '.claude');
  let scopeOrder: Array<{ claudeDir: string; scope: 'global' | 'project' }> = [];

  const globalAbs = path.resolve(globalDir);
  let globalExists = false;
  try {
    await fs.access(globalDir);
    globalExists = true;
  } catch {
    // global dir doesn't exist
  }

  if (globalExists && !seen.has(globalAbs)) {
    scopeOrder.push({ claudeDir: globalAbs, scope: 'global' });
  }

  for (const dir of allClaudeDirs) {
    const scope: 'global' | 'project' = isGlobalScope(dir) ? 'global' : 'project';
    scopeOrder.push({ claudeDir: dir, scope });
  }

  // Move global scope to front if present in allClaudeDirs
  scopeOrder = [
    ...scopeOrder.filter((s) => s.scope === 'global'),
    ...scopeOrder.filter((s) => s.scope !== 'global'),
  ];

  // 5. Build scopes
  const scopes: ScopeNode[] = [];

  for (const { claudeDir, scope } of scopeOrder) {
    const parentDir = path.dirname(claudeDir);
    const parentName = path.basename(parentDir);
    const label = scope === 'global' ? 'Global (~/.claude)' : parentName;
    const projectId = crypto.createHash('sha1').update(claudeDir).digest('hex');
    const id = projectId;

    const artifacts = await classifyScope(claudeDir, scope, projectId);

    scopes.push({
      id,
      label,
      scope,
      rootPath: claudeDir,
      artifacts,
      artifactCount: artifacts.length,
    });
  }

  const totalArtifacts = scopes.reduce((sum, s) => sum + s.artifactCount, 0);

  return {
    scannedAt: new Date().toISOString(),
    targetDir,
    scopes,
    totalArtifacts,
  };
}
