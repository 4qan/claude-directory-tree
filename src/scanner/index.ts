import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import os from 'node:os';
import { findClaudeDirs } from './discover.js';
import { classifyScope, isGlobalScope } from './classify.js';
import type { ScanResponse, ScopeNode } from './types.js';

const CONFIG_DIR = path.join(homedir(), '.claude-directory-tree');

/**
 * Decode a Claude Code project cache directory name back to its original filesystem path.
 * On Unix, the encoding replaces `/` and spaces with `-` (e.g. `/Users/bob/proj` -> `-Users-bob-proj`).
 * On Windows, backslashes and colons are also replaced (e.g. `C:\Users\bob\proj` -> `C--Users-bob-proj`).
 */
export function decodeProjectCacheName(encodedName: string): string {
  if (os.platform() === 'win32') {
    // Windows encoding: C:\Users\bob\proj -> C-Users-bob-proj (colon -> -, backslash -> -)
    // Or double-hyphen variant: C--Users-bob (colon -> -, backslash -> -)
    const driveLetter = encodedName[0].toUpperCase();
    let rest: string;
    if (encodedName[1] === '-' && encodedName[2] === '-') {
      // Double-hyphen: C--Users-bob -> drive letter + skip "C--", replace remaining - with \
      rest = encodedName.slice(3).replace(/-/g, '\\');
    } else {
      // Single-hyphen: C-Users-bob -> drive letter + skip "C-", replace remaining - with \
      rest = encodedName.slice(2).replace(/-/g, '\\');
    }
    return `${driveLetter}:\\${rest}`;
  }
  // Unix: /Users/bob/proj -> -Users-bob-proj
  return '/' + encodedName.slice(1).replace(/-/g, '/');
}

async function getHiddenScopes(): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(CONFIG_DIR, 'config.json'), 'utf-8');
    const config = JSON.parse(raw);
    return config.hiddenScopes ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolve an ambiguously-decoded project path. The encoding replaces both `/` and ` ` with `-`,
 * so we walk the path segment by segment: at each level, check if a directory exists, and if not,
 * try merging the next segment with a space. This handles names like "Car Research" or
 * "Claude Directory Tree" that contain spaces.
 */
async function resolveProjectPath(naivePath: string): Promise<string | null> {
  const segments = naivePath.split(path.sep).filter(Boolean);
  let current = path.parse(naivePath).root || '/';

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
      const naiveDecoded = decodeProjectCacheName(entry.name);
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
      const segments = naiveDecoded.split(path.sep).filter(Boolean);
      const naiveDecodedRoot = path.parse(naiveDecoded).root || '/';
      for (let depth = 3; depth <= Math.min(5, segments.length - 1); depth++) {
        const parent = path.join(naiveDecodedRoot, ...segments.slice(0, depth));
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

  // Filter out empty and hidden scopes, then sort: global first, current project second, rest alphabetical
  const hiddenScopes = await getHiddenScopes();
  const nonEmptyScopes = scopes
    .filter((s) => s.artifactCount > 0)
    .filter((s) => !hiddenScopes.some((h) => s.label.includes(h)))
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
