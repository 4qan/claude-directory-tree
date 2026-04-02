import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { findClaudeDirs } from './discover.js';
import { classifyScope, isGlobalScope } from './classify.js';
import type { ScanResponse, ScopeNode } from './types.js';

/**
 * Resolve an ambiguously-decoded project path. The encoding replaces both `/` and ` ` with `-`,
 * so we walk the path segment by segment: at each level, check if a directory exists, and if not,
 * try merging the next segment with a space. This handles names like "Car Research" or
 * "Claude Directory Tree" that contain spaces.
 */
async function resolveProjectPath(naivePath: string): Promise<string | null> {
  const segments = naivePath.split('/').filter(Boolean);
  let current = '/';

  for (let i = 0; i < segments.length; i++) {
    const candidate = path.join(current, segments[i]);
    try {
      await fs.access(candidate);
      current = candidate;
      continue;
    } catch {
      // Segment doesn't exist as-is. Try merging with following segments using
      // spaces or dashes (the encoding is ambiguous for both).
      let found = false;
      for (const sep of [' ', '-']) {
        let merged = segments[i];
        for (let j = i + 1; j < segments.length; j++) {
          merged += sep + segments[j];
          const mergedPath = path.join(current, merged);
          try {
            await fs.access(mergedPath);
            current = mergedPath;
            i = j; // skip consumed segments
            found = true;
            break;
          } catch {
            // keep trying more segments
          }
        }
        if (found) break;
      }
      if (!found) return null;
    }
  }

  return current;
}

export async function runScan(targetDir: string): Promise<ScanResponse> {
  // 1. Discover .claude dirs under targetDir
  const discoveredDirs = await findClaudeDirs(targetDir);

  // 2. Discover projects that Claude Code knows about.
  //    ~/.claude/projects/ contains per-project settings with lossy-encoded directory names.
  //    Instead of reverse-engineering the encoding, extract unique parent directories
  //    and scan those for .claude dirs.
  const projectsCacheDir = path.join(homedir(), '.claude', 'projects');
  try {
    const projectEntries = await fs.readdir(projectsCacheDir, { withFileTypes: true });
    const parentCandidates = new Set<string>();

    for (const entry of projectEntries) {
      if (!entry.isDirectory()) continue;
      const naiveDecoded = '/' + entry.name.slice(1).replace(/-/g, '/');
      // Try the naive decode first (works for paths without spaces/dashes)
      const claudeDir = path.join(naiveDecoded, '.claude');
      try {
        await fs.access(claudeDir);
        discoveredDirs.push(claudeDir);
        continue;
      } catch {
        // Naive decode failed — collect parent directories for broad scanning
      }
      // Try resolving with the segment-walking approach
      const resolved = await resolveProjectPath(naiveDecoded);
      if (resolved) {
        const resolvedClaude = path.join(resolved, '.claude');
        try {
          await fs.access(resolvedClaude);
          discoveredDirs.push(resolvedClaude);
          continue;
        } catch {
          // resolved path exists but has no .claude dir
        }
      }
      // Still unresolved — add common parent directories for broad scan
      // Extract the first 3-4 segments as a likely parent directory
      const segments = naiveDecoded.split('/').filter(Boolean);
      for (let depth = 3; depth <= Math.min(5, segments.length - 1); depth++) {
        const parent = '/' + segments.slice(0, depth).join('/');
        try {
          await fs.access(parent);
          parentCandidates.add(parent);
          break;
        } catch {
          // try deeper
        }
      }
    }

    // Scan unresolved parent directories for .claude dirs
    for (const parentDir of parentCandidates) {
      const found = await findClaudeDirs(parentDir);
      discoveredDirs.push(...found);
    }
  } catch {
    // no projects cache dir -- skip
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
  const targetDirAbs = path.resolve(targetDir);
  const scopes: ScopeNode[] = [];

  for (const { claudeDir, scope } of scopeOrder) {
    const parentDir = path.dirname(claudeDir);
    const parentName = path.basename(parentDir);
    const label = scope === 'global' ? 'Global (~/.claude)' : parentName;
    const projectId = crypto.createHash('sha1').update(claudeDir).digest('hex');
    const id = projectId;

    // Determine section: global, current project, or other projects
    const isCurrent = scope === 'project' && path.resolve(parentDir) === targetDirAbs;
    const section = scope === 'global' ? 'global' as const
      : isCurrent ? 'current' as const
      : 'projects' as const;

    const artifacts = await classifyScope(claudeDir, scope, projectId);

    scopes.push({
      id,
      label,
      scope,
      section,
      rootPath: claudeDir,
      artifacts,
      artifactCount: artifacts.length,
    });
  }

  // Filter out empty scopes, then sort: global first, current project second, rest alphabetical
  const nonEmptyScopes = scopes
    .filter((s) => s.artifactCount > 0)
    .sort((a, b) => {
      const order = { global: 0, current: 1, projects: 2 };
      const sectionDiff = order[a.section] - order[b.section];
      if (sectionDiff !== 0) return sectionDiff;
      return a.label.localeCompare(b.label);
    });
  const totalArtifacts = nonEmptyScopes.reduce((sum, s) => sum + s.artifactCount, 0);

  return {
    scannedAt: new Date().toISOString(),
    targetDir,
    scopes: nonEmptyScopes,
    totalArtifacts,
  };
}
