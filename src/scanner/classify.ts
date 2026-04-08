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

  let frontmatter: Record<string, unknown> | undefined;
  let typeOverride: ArtifactType | undefined;
  let frontmatterName: string | undefined;

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
            'mcp-config', 'memory', 'plan', 'plugin',
          ].includes(frontmatter['type'])
        ) {
          typeOverride = frontmatter['type'] as ArtifactType;
        }
        // Use frontmatter name if available
        if (typeof frontmatter['name'] === 'string' && frontmatter['name'].trim()) {
          frontmatterName = frontmatter['name'].trim();
        }
      }
    } catch {
      // unreadable file -- continue with path-based classification
    }
  }

  const type: ArtifactType = typeOverride ?? classifyByPath(filePath) ?? 'unknown';

  // Name resolution: frontmatter name > parent dir name for generic filenames > filename
  const GENERIC_NAMES = new Set(['SKILL', 'README', 'Readme', 'readme', 'HISTORY', 'History', 'CHANGELOG', 'SECURITY', 'INDEX', 'index']);
  let effectiveName: string;
  if (basename === 'plugin.json') {
    // Read plugin name from plugin.json content, fall back to grandparent dir
    let pluginJsonName: string | undefined;
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.name === 'string') pluginJsonName = parsed.name;
    } catch { /* ignore */ }
    effectiveName = pluginJsonName ?? path.basename(path.dirname(path.dirname(filePath)));
  } else if (frontmatterName) {
    effectiveName = frontmatterName;
  } else if (GENERIC_NAMES.has(name)) {
    // Use parent directory name for generic filenames like SKILL.md
    effectiveName = path.basename(path.dirname(filePath));
  } else {
    effectiveName = name;
  }

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
      if (PLUGIN_SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        promises.push(walkPlugin(fullPath));
      } else if (entry.isFile() && entry.name !== 'plugin.json') {
        promises.push(
          classifyFile(fullPath, claudeDir, scope, projectId).then((a) => {
            if (a.type !== 'unknown') children.push(a);
          }),
        );
      }
    }
    await Promise.all(promises);
  }

  await walkPlugin(pluginDir);

  // Deduplicate children by name+type
  const seen = new Map<string, Artifact>();
  for (const child of children) {
    const key = `${child.type}:${child.name}`;
    if (!seen.has(key)) {
      seen.set(key, child);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Directories that contain artifacts worth scanning.
// Everything else (cache, telemetry, sessions, etc.) is ignored.
const ARTIFACT_DIRS = new Set([
  'commands', 'agents', 'skills', 'memory', 'plans', 'hooks', 'references',
]);

// Directories to never recurse into during plugin expansion
const PLUGIN_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv',
]);

async function walkArtifactDir(dir: string, files: string[]): Promise<void> {
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
      promises.push(walkArtifactDir(fullPath, files));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  await Promise.all(promises);
}

export async function classifyScope(
  claudeDir: string,
  scope: 'global' | 'project',
  projectId: string,
): Promise<Artifact[]> {
  const allFiles: string[] = [];

  // 1. Collect top-level files (CLAUDE.md, .mcp.json, settings.json, plugin.json)
  let topEntries;
  try {
    topEntries = await fs.readdir(claudeDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of topEntries) {
    if (entry.isFile()) {
      allFiles.push(path.join(claudeDir, entry.name));
    }
  }

  // 2. Walk only artifact-relevant subdirectories
  const walkPromises: Promise<void>[] = [];
  for (const entry of topEntries) {
    if (entry.isDirectory() && ARTIFACT_DIRS.has(entry.name)) {
      walkPromises.push(walkArtifactDir(path.join(claudeDir, entry.name), allFiles));
    }
  }
  await Promise.all(walkPromises);

  // 2b. For project scopes, also check the global project cache for memory files.
  //     Memory is stored at ~/.claude/projects/{encoded-path}/memory/
  //     Encoding: / and spaces become -
  if (scope === 'project') {
    const projectRoot = path.dirname(claudeDir);
    const encoded = projectRoot.replace(/[\/\\ :]/g, '-');
    const cacheMemoryDir = path.join(homedir(), '.claude', 'projects', encoded, 'memory');
    await walkArtifactDir(cacheMemoryDir, allFiles);
  }

  // 3. Scan plugins directory for plugin.json files only (not all files)
  const pluginsDir = path.join(claudeDir, 'plugins');
  const pluginJsonPaths = await findPluginJsonFiles(pluginsDir);
  allFiles.push(...pluginJsonPaths);

  // 4. Build initial artifacts from files, drop unknowns and GSD system commands in project scopes
  const artifactPromises = allFiles.map((f) => classifyFile(f, claudeDir, scope, projectId));
  const rawArtifacts = (await Promise.all(artifactPromises))
    .filter((a) => a.type !== 'unknown')
    .filter((a) => {
      // GSD installs command copies into every project's .claude/commands/gsd/.
      // These are system-level commands, not project-specific. Filter them out for project scopes.
      if (scope === 'project' && a.absolutePath.replace(/\\/g, '/').includes('/commands/gsd/')) {
        return false;
      }
      return true;
    });

  // 5. Extract individual MCP servers from all config sources.
  //    Each server is tagged with its mcpScope for UI grouping.
  //    Precedence: local > project > user (first seen wins via mcpSeen).
  const mcpArtifacts: Artifact[] = [];
  const mcpSeen = new Set<string>();

  function addMcpServer(serverName: string, sourcePath: string, mcpScope: 'project' | 'local' | 'user'): void {
    if (mcpSeen.has(serverName)) return;
    mcpSeen.add(serverName);
    mcpArtifacts.push({
      id: crypto.createHash('sha1').update(`${projectId}:${sourcePath}#${serverName}`).digest('hex'),
      name: serverName,
      type: 'mcp-config',
      absolutePath: `${sourcePath}#${serverName}`,
      relativePath: path.relative(path.dirname(claudeDir), sourcePath) + `#${serverName}`,
      scope,
      projectId,
      mcpScope,
    });
  }

  function extractServers(config: Record<string, unknown>): Record<string, unknown> {
    return (typeof config.mcpServers === 'object' && config.mcpServers !== null)
      ? config.mcpServers as Record<string, unknown>
      : config;
  }

  // a) .mcp.json files in .claude/ or project root
  //    Global scope: these are user-level configs
  //    Project scope: these are project-level configs
  const mcpJsonScope = scope === 'global' ? 'user' as const : 'project' as const;
  const mcpPaths = [
    path.join(claudeDir, '.mcp.json'),
    path.join(path.dirname(claudeDir), '.mcp.json'),
  ];
  for (const mcpPath of mcpPaths) {
    try {
      const raw = await fs.readFile(mcpPath, 'utf-8');
      const servers = extractServers(JSON.parse(raw) as Record<string, unknown>);
      for (const name of Object.keys(servers)) addMcpServer(name, mcpPath, mcpJsonScope);
    } catch {
      // no .mcp.json at this location
    }
  }

  // b) & c) from ~/.claude.json
  const claudeJsonPath = path.join(homedir(), '.claude.json');
  try {
    const raw = await fs.readFile(claudeJsonPath, 'utf-8');
    const claudeJson = JSON.parse(raw) as Record<string, unknown>;

    // b) Local MCPs: project-specific overrides in ~/.claude.json
    if (scope === 'project' && typeof claudeJson.projects === 'object' && claudeJson.projects) {
      const projectRoot = path.dirname(claudeDir);
      const projects = claudeJson.projects as Record<string, Record<string, unknown>>;
      for (const [projectPath, config] of Object.entries(projects)) {
        if (path.resolve(projectPath) === path.resolve(projectRoot) && config.mcpServers) {
          for (const name of Object.keys(config.mcpServers as Record<string, unknown>)) {
            addMcpServer(name, claudeJsonPath, 'local');
          }
        }
      }
    }

    // c) User MCPs: global mcpServers in ~/.claude.json (global scope only)
    if (scope === 'global' && typeof claudeJson.mcpServers === 'object' && claudeJson.mcpServers) {
      for (const name of Object.keys(claudeJson.mcpServers as Record<string, unknown>)) {
        addMcpServer(name, claudeJsonPath, 'user');
      }
    }
  } catch {
    // no ~/.claude.json
  }

  // 6. Extract hooks from settings.json
  //    Format: { hooks: { "EventName": [{ hooks: [{ type, command }] }] } }
  const hookArtifacts: Artifact[] = [];
  const settingsPath = path.join(claudeDir, 'settings.json');
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    if (settings.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks)) {
      for (const [eventName, matchers] of Object.entries(settings.hooks)) {
        if (!Array.isArray(matchers)) continue;
        for (let i = 0; i < matchers.length; i++) {
          const matcher = matchers[i] as { hooks?: Array<{ type?: string; command?: string }> };
          if (!Array.isArray(matcher.hooks)) continue;
          for (let j = 0; j < matcher.hooks.length; j++) {
            const hookDef = matcher.hooks[j];
            const hookId = `${eventName}-${i}-${j}`;
            const hookName = `${eventName}`;
            hookArtifacts.push({
              id: crypto.createHash('sha1').update(`${projectId}:${settingsPath}#${hookId}`).digest('hex'),
              name: hookName,
              type: 'hook',
              absolutePath: `${settingsPath}#${hookId}`,
              relativePath: path.relative(path.dirname(claudeDir), settingsPath) + `#${hookId}`,
              scope,
              projectId,
            });
          }
        }
      }
    }
  } catch {
    // no settings.json or invalid JSON -- skip
  }

  // 6. Plugin expansion + enabled status
  //    enabledPlugins in settings.json: { "name@marketplace": true/false }
  let enabledPlugins: Record<string, boolean> = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as Record<string, unknown>;
    if (typeof settings.enabledPlugins === 'object' && settings.enabledPlugins) {
      enabledPlugins = settings.enabledPlugins as Record<string, boolean>;
    }
  } catch {
    // already read settings above for hooks, but enabledPlugins is separate
  }

  const pluginArtifactsWithChildren: Artifact[] = [];
  const childAbsolutePaths = new Set<string>();

  for (const artifact of rawArtifacts) {
    if (artifact.type === 'plugin') {
      const pluginJsonDir = path.dirname(artifact.absolutePath);
      // Cached plugins: plugin.json lives in .claude-plugin/ subdir; artifacts are in the parent
      const pluginDir = path.basename(pluginJsonDir) === '.claude-plugin'
        ? path.dirname(pluginJsonDir)
        : pluginJsonDir;
      const children = await expandPlugin(pluginDir, scope, projectId, claudeDir);
      for (const child of children) {
        childAbsolutePaths.add(child.absolutePath);
      }
      // Check enabled status: match "name@marketplace" pattern in enabledPlugins
      const isEnabled = Object.entries(enabledPlugins).some(
        ([key, val]) => key.startsWith(artifact.name + '@') && val === true,
      );
      pluginArtifactsWithChildren.push({ ...artifact, children, enabled: isEnabled });
    }
  }

  // Filter out children from top-level, replace plugin artifacts with expanded versions,
  // and remove raw .mcp.json (replaced by individual server artifacts)
  const topLevelArtifacts = rawArtifacts
    .filter((a) => !childAbsolutePaths.has(a.absolutePath))
    .filter((a) => !(a.type === 'mcp-config' && a.absolutePath.endsWith('.mcp.json')))
    .map((a) => {
      if (a.type === 'plugin') {
        return pluginArtifactsWithChildren.find((p) => p.absolutePath === a.absolutePath) ?? a;
      }
      return a;
    });

  // 8. Deduplicate by name+type (keep first occurrence)
  const combined = [...topLevelArtifacts, ...mcpArtifacts, ...hookArtifacts];
  const seen = new Map<string, Artifact>();
  for (const artifact of combined) {
    const key = `${artifact.type}:${artifact.name}`;
    if (!seen.has(key)) {
      seen.set(key, artifact);
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function findPluginJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    const promises: Promise<void>[] = [];
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        promises.push(walk(fullPath));
      } else if (entry.isFile() && entry.name === 'plugin.json') {
        results.push(fullPath);
      }
    }
    await Promise.all(promises);
  }
  await walk(dir);
  return results;
}

export function isGlobalScope(claudeDir: string): boolean {
  return claudeDir === path.join(homedir(), '.claude');
}
