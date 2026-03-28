export type ArtifactType = 'command' | 'agent' | 'skill' | 'hook' | 'claude-md' | 'mcp-config' | 'memory' | 'plan' | 'plugin' | 'unknown';

export const ARTIFACT_TYPES: ArtifactType[] = ['command', 'agent', 'skill', 'hook', 'claude-md', 'mcp-config', 'memory', 'plan', 'plugin', 'unknown'];

export type Artifact = {
  id: string;
  name: string;
  type: ArtifactType;
  absolutePath: string;
  relativePath: string;
  scope: 'global' | 'project';
  projectId: string;
  frontmatter?: Record<string, unknown>;
  children?: Artifact[];
};

export type ScopeNode = {
  id: string;
  label: string;
  scope: 'global' | 'project';
  rootPath: string;
  artifacts: Artifact[];
  artifactCount: number;
};

export type ScanResponse = {
  scannedAt: string;
  targetDir: string;
  scopes: ScopeNode[];
  totalArtifacts: number;
};
