import { z } from 'zod';

export const ArtifactTypeSchema = z.enum([
  'command', 'agent', 'skill', 'hook', 'claude-md',
  'mcp-config', 'memory', 'plan', 'plugin', 'unknown'
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

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
};

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
});

export const ScopeNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  scope: z.enum(['global', 'project']),
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
