// Type-safe fetch wrappers for /api/operations/* endpoints

type OperationResult = {
  success: boolean;
  destPath?: string;
  conflict?: boolean;
  warnings?: { type: string; message: string }[];
  error?: string;
};
type DescribeResult = { description: string | null };

// Single client-side source of truth for type -> directory mapping.
// Plan 03 (ContextMenu) MUST import this instead of re-defining inline.
export const TYPE_DIR_MAP: Record<string, string> = {
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

export async function openInEditor(path: string): Promise<OperationResult> {
  const res = await fetch('/api/operations/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return res.json();
}

export async function copyArtifact(
  sourcePath: string,
  destinationDir: string,
  artifactType: string,
  overwrite = false
): Promise<OperationResult> {
  const res = await fetch('/api/operations/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, destinationDir, artifactType, overwrite }),
  });
  return res.json();
}

export async function moveArtifact(
  sourcePath: string,
  destinationDir: string,
  artifactType: string,
  overwrite = false
): Promise<OperationResult> {
  const res = await fetch('/api/operations/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, destinationDir, artifactType, overwrite }),
  });
  return res.json();
}

export async function promoteArtifact(
  sourcePath: string,
  artifactType: string,
  overwrite = false
): Promise<OperationResult> {
  const res = await fetch('/api/operations/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, artifactType, overwrite }),
  });
  return res.json();
}

export async function demoteArtifact(
  sourcePath: string,
  targetProjectDir: string,
  artifactType: string,
  overwrite = false
): Promise<OperationResult> {
  const res = await fetch('/api/operations/demote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, targetProjectDir, artifactType, overwrite }),
  });
  return res.json();
}

type PreflightResult = { warnings: { type: string; message: string }[] };

export async function preflightCheck(sourcePath: string, artifactType: string): Promise<PreflightResult> {
  const res = await fetch('/api/operations/preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, artifactType }),
  });
  return res.json();
}

export async function describeArtifact(path: string): Promise<DescribeResult> {
  const res = await fetch('/api/operations/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return res.json();
}

// Copy Path: resolves the correct path per node kind and copies to clipboard.
// Returns the resolved path string.
export function resolveCopyPath(
  nodeKind: string,
  data: {
    absolutePath?: string;
    type?: string;
    rootPath?: string;
    id?: string;
  }
): string {
  if (nodeKind === 'leaf') {
    const absPath = data.absolutePath ?? '';
    // Virtual artifacts: strip # fragment, return parent file path
    if (absPath.includes('#')) return absPath.split('#')[0];
    // Directory types: return parent directory
    if (data.type === 'skill' || data.type === 'plugin') {
      // absolutePath points to SKILL.md or plugin.json inside the dir
      return absPath.substring(0, absPath.lastIndexOf('/'));
    }
    return absPath;
  }
  if (nodeKind === 'scope') {
    return data.rootPath ?? '';
  }
  if (nodeKind === 'category') {
    // Category id is "scopeId:type". Derive dir from scope rootPath + type dir.
    // data.rootPath must be the resolved scopeRootPath for categories.
    const typeDir = TYPE_DIR_MAP[data.type ?? ''] ?? '';
    return (data.rootPath ?? '') + (typeDir ? '/' + typeDir : '');
  }
  return '';
}

export async function copyPathToClipboard(resolvedPath: string): Promise<void> {
  await navigator.clipboard.writeText(resolvedPath);
}
