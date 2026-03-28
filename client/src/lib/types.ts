export type ArtifactType = 'command' | 'agent' | 'skill' | 'hook' | 'claude-md' | 'mcp-config' | 'memory' | 'plan' | 'plugin' | 'unknown';

export const ARTIFACT_TYPES: ArtifactType[] = ['command', 'agent', 'skill', 'hook', 'claude-md', 'mcp-config', 'memory', 'plan', 'plugin'];

export type McpScope = 'project' | 'local' | 'user';

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
  mcpScope?: McpScope;
  enabled?: boolean;
};

export type ScopeSection = 'global' | 'current' | 'projects';

export type ScopeNode = {
  id: string;
  label: string;
  scope: 'global' | 'project';
  section: ScopeSection;
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
