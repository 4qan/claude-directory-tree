import { z } from 'zod';

export const ArtifactTypeSchema = z.enum([
  'command', 'agent', 'skill', 'hook', 'claude-md',
  'mcp-config', 'memory', 'plan', 'plugin', 'unknown'
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export type McpScope = 'project' | 'local' | 'user';

// Define the TypeScript type first for the recursive reference
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

export const McpScopeSchema = z.enum(['project', 'local', 'user']);

// Zod v4 recursive schema requires explicit ZodType annotation
export const ArtifactSchema: z.ZodType<Artifact> = z.object({
  id: z.string(),
  name: z.string(),
  type: ArtifactTypeSchema,
  absolutePath: z.string(),
  relativePath: z.string(),
  scope: z.enum(['global', 'project']),
  projectId: z.string(),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  children: z.array(z.lazy(() => ArtifactSchema)).optional(),
  mcpScope: McpScopeSchema.optional(),
  enabled: z.boolean().optional(),
});

export type ScopeSection = 'global' | 'current' | 'projects';

export const ScopeSectionSchema = z.enum(['global', 'current', 'projects']);

export const ScopeNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  scope: z.enum(['global', 'project']),
  section: ScopeSectionSchema,
  rootPath: z.string(),
  artifacts: z.array(ArtifactSchema),
  artifactCount: z.number(),
});
export type ScopeNode = z.infer<typeof ScopeNodeSchema>;

export const ScanResponseSchema = z.object({
  scannedAt: z.string(),
  targetDir: z.string(),
  scopes: z.array(ScopeNodeSchema),
  totalArtifacts: z.number(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;
