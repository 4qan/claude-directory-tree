import type { ScopeNode, Artifact } from './types';
import type { TreeNodeData } from '@/components/tree/TreeItem';

// Artifact type -> filesystem directory name mapping (client-side)
const TYPE_DIR_MAP: Record<string, string> = {
  command: 'commands',
  agent: 'agents',
  skill: 'skills',
  memory: 'memory',
  plan: 'plans',
  'claude-md': '',
  plugin: 'plugins',
  hook: '',
  'mcp-config': '',
};

function folderId(absPath: string): string {
  return 'dir:' + absPath;
}

/**
 * Compute the longest common ancestor path across an array of absolute paths.
 * Only considers path segments (split on '/') — not arbitrary string prefixes.
 */
function commonAncestor(paths: string[]): string {
  if (paths.length === 0) return '/';
  if (paths.length === 1) return paths[0];
  const parts = paths.map((p) => p.split('/'));
  const shortest = Math.min(...parts.map((p) => p.length));
  let i = 0;
  while (i < shortest && parts.every((p) => p[i] === parts[0][i])) i++;
  return parts[0].slice(0, i).join('/') || '/';
}

/**
 * Index a single artifact into items/children, handling plugin children recursively.
 */
function indexArtifact(
  artifact: Artifact,
  items: Record<string, TreeNodeData>,
  siblingIds: string[]
): void {
  siblingIds.push(artifact.id);
  items[artifact.id] = { ...artifact, nodeKind: 'leaf' };

  if (artifact.children && artifact.children.length > 0) {
    const childIds: string[] = [];
    for (const child of artifact.children) {
      indexArtifact(child, items, childIds);
    }
    // Register children for the plugin node
    (items as Record<string, TreeNodeData & { _children?: string[] }>)[artifact.id]._children = childIds;
  }
}

/**
 * Ensure a folder node exists at the given path and is registered as a child
 * of its parent. Returns the folder node id.
 */
function ensureFolderNode(
  absPath: string,
  label: string,
  parentId: string,
  items: Record<string, TreeNodeData>,
  children: Record<string, string[]>
): string {
  const id = folderId(absPath);
  if (!items[id]) {
    items[id] = { nodeKind: 'folder', id, label, absolutePath: absPath };
    if (!children[id]) children[id] = [];
  }
  if (!children[parentId]) children[parentId] = [];
  if (!children[parentId].includes(id)) {
    children[parentId].push(id);
  }
  return id;
}

/**
 * Build directory view item maps from ScopeNode[].
 *
 * Produces a filesystem-path trie where:
 * - Global scope is always first root child as a 'scope' nodeKind node
 * - Project scopes appear under their filesystem path hierarchy
 * - Non-Claude ancestor directories become 'folder' nodeKind nodes with id 'dir:/path'
 * - Artifacts nest under their type directory folder nodes
 */
export function buildDirectoryItemMaps(
  filteredScopes: ScopeNode[],
  _currentProjectRootPath?: string
): {
  items: Record<string, TreeNodeData>;
  children: Record<string, string[]>;
} {
  const items: Record<string, TreeNodeData> = {
    root: { nodeKind: 'root' },
  };
  const children: Record<string, string[]> = {
    root: [],
  };

  const globalScopes = filteredScopes.filter((s) => s.scope === 'global');
  const projectScopes = filteredScopes.filter((s) => s.scope === 'project' && s.artifacts.length > 0);

  // 1. Add global scopes as first root children
  for (const scope of globalScopes) {
    items[scope.id] = { ...scope, nodeKind: 'scope' };
    children[scope.id] = [];
    children['root'].push(scope.id);

    // Index global scope artifacts by type directory
    const typeMap = new Map<string, Artifact[]>();
    for (const artifact of scope.artifacts) {
      const typeDir = TYPE_DIR_MAP[artifact.type] ?? '';
      const key = typeDir || '__root__';
      if (!typeMap.has(key)) typeMap.set(key, []);
      typeMap.get(key)!.push(artifact);
    }

    for (const [key, artifacts] of typeMap.entries()) {
      if (key === '__root__') {
        // Artifacts directly under .claude/ (e.g., claude-md, hook)
        for (const artifact of artifacts) {
          const leafIds: string[] = [];
          indexArtifact(artifact, items, leafIds);
          children[scope.id].push(...leafIds);
          // Register plugin children
          for (const id of leafIds) {
            const node = items[id] as Artifact & { nodeKind: 'leaf'; _children?: string[] };
            if (node._children) {
              children[id] = node._children;
              delete node._children;
            }
          }
        }
      } else {
        // Create type directory folder node under scope
        const typeDirPath = scope.rootPath + '/' + key;
        const typeFolderId = ensureFolderNode(typeDirPath, key, scope.id, items, children);
        for (const artifact of artifacts) {
          const leafIds: string[] = [];
          indexArtifact(artifact, items, leafIds);
          children[typeFolderId].push(...leafIds);
          for (const id of leafIds) {
            const node = items[id] as Artifact & { nodeKind: 'leaf'; _children?: string[] };
            if (node._children) {
              children[id] = node._children;
              delete node._children;
            }
          }
        }
      }
    }
  }

  // 2. Build filesystem trie for project scopes
  if (projectScopes.length === 0) return { items, children };

  // Compute common ancestor across project directories (parent of .claude/ rootPath).
  // We use the project directory (not rootPath) so that for a single project,
  // the ancestor is the project directory itself rather than its .claude subdir.
  const projectDirs = projectScopes.map((s) => {
    const r = s.rootPath;
    return r.substring(0, r.lastIndexOf('/'));
  });
  const ancestor = commonAncestor(projectDirs);

  // The common ancestor folder goes under root (after global scopes)
  // For each path segment from ancestor down to each project, create folder nodes
  for (const scope of projectScopes) {
    // rootPath is the .claude/ dir, e.g. /Users/furqan/.../ProjectA/.claude
    // The project dir is the parent of .claude
    const claudeDir = scope.rootPath; // e.g. /path/ProjectA/.claude
    const projectDir = claudeDir.substring(0, claudeDir.lastIndexOf('/')); // e.g. /path/ProjectA

    // Build the path chain from common ancestor to project dir
    // ancestor is already at segment level, so we split relative to it
    const ancestorSegments = ancestor === '/' ? [] : ancestor.split('/').filter(Boolean);
    const projectSegments = projectDir.split('/').filter(Boolean);

    // Build folders from ancestor to project dir
    let currentPath = ancestor;
    let parentId: string;

    if (ancestor === '/') {
      // Edge case: no common path, use absolute root
      parentId = 'root';
    } else {
      // Ensure the common ancestor folder exists under root
      const ancestorLabel = ancestorSegments[ancestorSegments.length - 1] ?? ancestor;
      const ancestorFolderId = folderId(ancestor);
      if (!items[ancestorFolderId]) {
        items[ancestorFolderId] = { nodeKind: 'folder', id: ancestorFolderId, label: ancestorLabel, absolutePath: ancestor };
        children[ancestorFolderId] = [];
        children['root'].push(ancestorFolderId);
      }
      parentId = ancestorFolderId;
    }

    // Walk from ancestor down to projectDir, creating folder nodes for each segment
    const segmentsAfterAncestor = projectSegments.slice(ancestorSegments.length);
    for (let i = 0; i < segmentsAfterAncestor.length; i++) {
      const segment = segmentsAfterAncestor[i];
      currentPath = currentPath === '/' ? '/' + segment : currentPath + '/' + segment;
      const segFolderId = folderId(currentPath);
      if (!items[segFolderId]) {
        items[segFolderId] = { nodeKind: 'folder', id: segFolderId, label: segment, absolutePath: currentPath };
        children[segFolderId] = [];
      }
      if (!children[parentId]) children[parentId] = [];
      if (!children[parentId].includes(segFolderId)) {
        children[parentId].push(segFolderId);
      }
      parentId = segFolderId;
    }

    // Now parentId is the project dir folder node
    const projectDirFolderId = folderId(projectDir);

    // Create .claude folder under the project dir
    const claudeFolderId = ensureFolderNode(claudeDir, '.claude', projectDirFolderId, items, children);

    // Register the scope node in items (preserve original ScopeNode data)
    items[scope.id] = { ...scope, nodeKind: 'scope' };
    children[scope.id] = [];

    // Link scope to .claude folder's children (scope is the content owner)
    // Actually the scope sits AT the .claude level — link .claude folder to scope
    // But the tree needs folder + scope separation. We'll put artifacts directly under
    // .claude folder grouped by type dir, and register the scope in items for badge access.

    // Group artifacts by type directory
    const typeMap = new Map<string, Artifact[]>();
    for (const artifact of scope.artifacts) {
      const typeDir = TYPE_DIR_MAP[artifact.type] ?? '';
      const key = typeDir || '__root__';
      if (!typeMap.has(key)) typeMap.set(key, []);
      typeMap.get(key)!.push(artifact);
    }

    for (const [key, artifacts] of typeMap.entries()) {
      if (key === '__root__') {
        // Directly under .claude/
        for (const artifact of artifacts) {
          const leafIds: string[] = [];
          indexArtifact(artifact, items, leafIds);
          children[claudeFolderId].push(...leafIds);
          for (const id of leafIds) {
            const node = items[id] as Artifact & { nodeKind: 'leaf'; _children?: string[] };
            if (node._children) {
              children[id] = node._children;
              delete node._children;
            }
          }
        }
      } else {
        // Create type directory folder under .claude/
        const typeDirPath = claudeDir + '/' + key;
        const typeFolderId = ensureFolderNode(typeDirPath, key, claudeFolderId, items, children);
        for (const artifact of artifacts) {
          const leafIds: string[] = [];
          indexArtifact(artifact, items, leafIds);
          children[typeFolderId].push(...leafIds);
          for (const id of leafIds) {
            const node = items[id] as Artifact & { nodeKind: 'leaf'; _children?: string[] };
            if (node._children) {
              children[id] = node._children;
              delete node._children;
            }
          }
        }
      }
    }
  }

  return { items, children };
}
