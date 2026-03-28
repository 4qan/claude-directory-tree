import { z } from 'zod';

// Artifact type -> filesystem directory name mapping
export const ARTIFACT_TYPE_DIR_MAP: Record<string, string> = {
  command: 'commands',
  agent: 'agents',
  skill: 'skills',
  memory: 'memory',
  plan: 'plans',
  'claude-md': '',       // root of .claude/
  plugin: 'plugins',
  hook: '',              // virtual, not used for copy
  'mcp-config': '',      // virtual, not used for copy
};

// Types blocked from copy/move/promote/demote (virtual artifacts)
export const BLOCKED_TYPES = ['hook', 'mcp-config'] as const;

// Types that show warnings on copy/move/promote/demote
export const WARNING_MESSAGES: Record<string, string> = {
  'claude-md': 'Global and project CLAUDE.md serve different purposes. Content may not be appropriate in the new scope.',
  plugin: 'Plugin enabled/disabled state (in settings.json) will not transfer. The plugin will need to be re-enabled manually.',
};

// Directory-based artifact types (copy entire dir, not just the file)
export const DIRECTORY_TYPES = ['skill', 'plugin'] as const;

// --- Zod Schemas for API request/response ---

export const OpenRequestSchema = z.object({
  path: z.string(),
});

export const CopyRequestSchema = z.object({
  sourcePath: z.string(),
  destinationDir: z.string(),
  artifactType: z.string(),
  overwrite: z.boolean().default(false),
});

export const MoveRequestSchema = z.object({
  sourcePath: z.string(),
  destinationDir: z.string(),
  artifactType: z.string(),
  overwrite: z.boolean().default(false),
});

export const PromoteRequestSchema = z.object({
  sourcePath: z.string(),
  artifactType: z.string(),
  overwrite: z.boolean().default(false),
});

export const DemoteRequestSchema = z.object({
  sourcePath: z.string(),
  targetProjectDir: z.string(),
  artifactType: z.string(),
  overwrite: z.boolean().default(false),
});

export const DescribeRequestSchema = z.object({
  path: z.string(),
});

export const PreflightWarningSchema = z.object({
  type: z.enum(['reference', 'semantic', 'state']),
  message: z.string(),
});

export const OperationResultSchema = z.object({
  success: z.boolean(),
  destPath: z.string().optional(),
  conflict: z.boolean().optional(),
  warnings: z.array(PreflightWarningSchema).optional(),
  error: z.string().optional(),
});

export const DescribeResultSchema = z.object({
  description: z.string().nullable(),
});

// Inferred types
export type OpenRequest = z.infer<typeof OpenRequestSchema>;
export type CopyRequest = z.infer<typeof CopyRequestSchema>;
export type MoveRequest = z.infer<typeof MoveRequestSchema>;
export type PromoteRequest = z.infer<typeof PromoteRequestSchema>;
export type DemoteRequest = z.infer<typeof DemoteRequestSchema>;
export type DescribeRequest = z.infer<typeof DescribeRequestSchema>;
export type OperationResult = z.infer<typeof OperationResultSchema>;
export type DescribeResult = z.infer<typeof DescribeResultSchema>;
export type PreflightWarning = z.infer<typeof PreflightWarningSchema>;
