import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import type { Artifact, ArtifactType } from './types.js';

function classifyByPath(filePath: string): ArtifactType | null {
  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, '/');

  if (basename === 'CLAUDE.md') return 'claude-md';
  if (basename === '.mcp.json') return 'mcp-config';
  if (basename === 'plugin.json') return 'plugin';
  if (normalized.includes('/commands/') && basename.endsWith('.md')) return 'command';
  if (normalized.includes('/agents/') && basename.endsWith('.md')) return 'agent';
  if (normalized.includes('/skills/') && basename.endsWith('.md')) return 'skill';
  if (normalized.includes('/memory/') && basename.endsWith('.md')) return 'memory';
  if (normalized.includes('/plans/') && basename.endsWith('.md')) return 'plan';

  return null;
}

export async function classifyFile(
  filePath: string,
  claudeDir: string,
  scope: 'global' | 'project',
  projectId: string,
): Promise<Artifact> {
  const id = crypto.createHash('sha1').update(filePath).digest('hex');
  const basename = path.basename(filePath);
  const ext = path.extname(basename);
  const name = ext ? basename.slice(0, -ext.length) : basename;
  const relativePath = path.relative(path.dirname(claudeDir), filePath);

  // For plugin.json, use parent directory name as the artifact name
  const effectiveName = basename === 'plugin.json' ? path.basename(path.dirname(filePath)) : name;

  let frontmatter: Record<string, unknown> | undefined;
  let typeOverride: ArtifactType | undefined;

  if (basename.endsWith('.md')) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(raw);
      if (parsed.data && Object.keys(parsed.data).length > 0) {
        frontmatter = parsed.data as Record<string, unknown>;
        // frontmatter type field overrides path-based classification
        if (
          typeof frontmatter['type'] === 'string' &&
          [
            'command', 'agent', 'skill', 'hook', 'claude-md',
            'mcp-config', 'memory', 'plan', 'plugin', 'unknown',
          ].includes(frontmatter['type'])
        ) {
          typeOverride = frontmatter['type'] as ArtifactType;
        }
      }
    } catch {
      // unreadable file -- continue with path-based classification
    }
  }

  const type: ArtifactType = typeOverride ?? classifyByPath(filePath) ?? 'unknown';

  return {
    id,
    name: effectiveName,
    type,
    absolutePath: filePath,
    relativePath,
    scope,
    projectId,
    frontmatter,
  };
}

export async function expandPlugin(
  pluginDir: string,
  scope: 'global' | 'project',
  projectId: string,
  claudeDir: string,
): Promise<Artifact[]> {
  const children: Artifact[] = [];

  async function walkPlugin(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const promises: Promise<void>[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        promises.push(walkPlugin(fullPath));
      } else if (entry.isFile() && entry.name !== 'plugin.json') {
        promises.push(
          classifyFile(fullPath, claudeDir, scope, projectId).then((a) => {
            children.push(a);
          }),
        );
      }
    }
    await Promise.all(promises);
  }

  await walkPlugin(pluginDir);
  return children.sort((a, b) => a.name.localeCompare(b.name));
}

export async function classifyScope(
  claudeDir: string,
  scope: 'global' | 'project',
  projectId: string,
): Promise<Artifact[]> {
  const allFiles: string[] = [];

  async function walkDir(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const promises: Promise<void>[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        promises.push(walkDir(fullPath));
      } else if (entry.isFile()) {
        allFiles.push(fullPath);
      }
    }
    await Promise.all(promises);
  }

  await walkDir(claudeDir);

  // Build initial artifacts from files
  const artifactPromises = allFiles.map((f) => classifyFile(f, claudeDir, scope, projectId));
  const rawArtifacts = await Promise.all(artifactPromises);

  // Extract hooks from settings.json
  const hookArtifacts: Artifact[] = [];
  const settingsPath = path.join(claudeDir, 'settings.json');
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as { hooks?: Array<{ name?: string; event?: string }> };
    if (Array.isArray(settings.hooks)) {
      for (let i = 0; i < settings.hooks.length; i++) {
        const hook = settings.hooks[i];
        const hookName = hook.name ?? hook.event ?? `hook-${i}`;
        hookArtifacts.push({
          id: crypto.createHash('sha1').update(`${settingsPath}#hook-${i}`).digest('hex'),
          name: hookName,
          type: 'hook',
          absolutePath: `${settingsPath}#hook-${i}`,
          relativePath: path.relative(path.dirname(claudeDir), settingsPath) + `#hook-${i}`,
          scope,
          projectId,
        });
      }
    }
  } catch {
    // no settings.json or invalid JSON -- skip
  }

  // Plugin expansion
  const pluginArtifactsWithChildren: Artifact[] = [];
  const childAbsolutePaths = new Set<string>();

  for (const artifact of rawArtifacts) {
    if (artifact.type === 'plugin') {
      const pluginDir = path.dirname(artifact.absolutePath);
      const children = await expandPlugin(pluginDir, scope, projectId, claudeDir);
      for (const child of children) {
        childAbsolutePaths.add(child.absolutePath);
      }
      pluginArtifactsWithChildren.push({ ...artifact, children });
    }
  }

  // Filter out children from top-level, replace plugin artifacts with expanded versions
  const topLevelArtifacts = rawArtifacts
    .filter((a) => !childAbsolutePaths.has(a.absolutePath))
    .map((a) => {
      if (a.type === 'plugin') {
        return pluginArtifactsWithChildren.find((p) => p.absolutePath === a.absolutePath) ?? a;
      }
      return a;
    });

  const combined = [...topLevelArtifacts, ...hookArtifacts];
  return combined.sort((a, b) => a.name.localeCompare(b.name));
}

export function isGlobalScope(claudeDir: string): boolean {
  return claudeDir === path.join(homedir(), '.claude');
}
