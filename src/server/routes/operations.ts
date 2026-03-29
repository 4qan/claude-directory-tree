import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import open from 'open';
import matter from 'gray-matter';
import {
  OpenRequestSchema,
  CopyRequestSchema,
  MoveRequestSchema,
  PromoteRequestSchema,
  DemoteRequestSchema,
  PreflightRequestSchema,
  PreflightResultSchema,
  DescribeRequestSchema,
  OperationResultSchema,
  DescribeResultSchema,
  ARTIFACT_TYPE_DIR_MAP,
  BLOCKED_TYPES,
  WARNING_MESSAGES,
  DIRECTORY_TYPES,
  type PreflightWarning,
} from '../../shared/operationTypes.js';

/**
 * Scan a file or directory for @-include absolute references.
 * Returns warnings for each unique absolute @-include found.
 */
async function scanReferences(sourcePath: string): Promise<PreflightWarning[]> {
  const warnings: PreflightWarning[] = [];
  const seen = new Set<string>();

  async function scanFile(filePath: string): Promise<void> {
    if (!filePath.endsWith('.md')) return;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (/^@\//.test(line)) {
          const trimmed = line.trim();
          if (!seen.has(trimmed)) {
            seen.add(trimmed);
            warnings.push({
              type: 'reference',
              message: `References external file via @-include: ${trimmed}`,
            });
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(sourcePath);
  } catch {
    return warnings;
  }

  if (stat.isDirectory()) {
    const entries = await fs.readdir(sourcePath, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(sourcePath, entry as string);
      await scanFile(fullPath);
    }
  } else {
    await scanFile(sourcePath);
  }

  return warnings;
}

/**
 * Determine the actual copy source path.
 * For directory-based types (skill, plugin), use the parent directory.
 * For file-based types, use the file itself.
 */
function getCopySource(sourcePath: string, artifactType: string): string {
  if ((DIRECTORY_TYPES as readonly string[]).includes(artifactType)) {
    return path.dirname(sourcePath);
  }
  return sourcePath;
}

/**
 * Core copy logic: conflict check, pre-flight scan, execute copy.
 */
async function performCopy(
  sourcePath: string,
  destinationDir: string,
  artifactType: string,
  overwrite: boolean
): Promise<{ success: boolean; destPath?: string; conflict?: boolean; warnings?: PreflightWarning[]; error?: string }> {
  // Block virtual artifacts
  if ((BLOCKED_TYPES as readonly string[]).includes(artifactType)) {
    return { success: false, error: 'This artifact cannot be copied (managed within a JSON config file)' };
  }

  const copySource = getCopySource(sourcePath, artifactType);
  const destPath = path.join(destinationDir, path.basename(copySource));

  // Conflict check
  if (!overwrite) {
    try {
      await fs.access(destPath);
      return { success: false, conflict: true };
    } catch {
      // Does not exist — proceed
    }
  }

  // Pre-flight reference scan
  const warnings: PreflightWarning[] = await scanReferences(copySource);

  // Type-based warnings
  if (WARNING_MESSAGES[artifactType]) {
    const warningType = artifactType === 'claude-md' ? 'semantic' : 'state';
    warnings.push({ type: warningType, message: WARNING_MESSAGES[artifactType] });
  }

  // Execute copy
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.cp(copySource, destPath, { recursive: true });

  return { success: true, destPath, warnings: warnings.length > 0 ? warnings : undefined };
}

export async function operationsRoutes(server: FastifyInstance, _targetDir: string): Promise<void> {
  const s = (server as FastifyInstance).withTypeProvider<ZodTypeProvider>();

  // POST /api/operations/open
  s.post(
    '/api/operations/open',
    { schema: { body: OpenRequestSchema } },
    async (req, reply) => {
      await open(req.body.path);
      return reply.send({ success: true });
    }
  );

  // POST /api/operations/copy
  s.post(
    '/api/operations/copy',
    {
      schema: {
        body: CopyRequestSchema,
        response: { 200: OperationResultSchema, 400: OperationResultSchema },
      },
    },
    async (req, reply) => {
      const { sourcePath, destinationDir, artifactType, overwrite } = req.body;

      if ((BLOCKED_TYPES as readonly string[]).includes(artifactType)) {
        return reply.code(400).send({
          success: false,
          error: 'This artifact cannot be copied (managed within a JSON config file)',
        });
      }

      const result = await performCopy(sourcePath, destinationDir, artifactType, overwrite);
      return reply.send(result);
    }
  );

  // POST /api/operations/move
  s.post(
    '/api/operations/move',
    {
      schema: {
        body: MoveRequestSchema,
        response: { 200: OperationResultSchema, 400: OperationResultSchema },
      },
    },
    async (req, reply) => {
      const { sourcePath, destinationDir, artifactType, overwrite } = req.body;

      if ((BLOCKED_TYPES as readonly string[]).includes(artifactType)) {
        return reply.code(400).send({
          success: false,
          error: 'This artifact cannot be moved (managed within a JSON config file)',
        });
      }

      const copySource = getCopySource(sourcePath, artifactType);
      const result = await performCopy(sourcePath, destinationDir, artifactType, overwrite);

      if (result.success) {
        // CRITICAL: Use fs.rm, NEVER fs.rename (avoids EXDEV across filesystems)
        await fs.rm(copySource, { recursive: true, force: true });
      }

      return reply.send(result);
    }
  );

  // POST /api/operations/promote
  s.post(
    '/api/operations/promote',
    {
      schema: {
        body: PromoteRequestSchema,
        response: { 200: OperationResultSchema, 400: OperationResultSchema },
      },
    },
    async (req, reply) => {
      const { sourcePath, artifactType, overwrite } = req.body;

      if ((BLOCKED_TYPES as readonly string[]).includes(artifactType)) {
        return reply.code(400).send({
          success: false,
          error: 'This artifact cannot be promoted (managed within a JSON config file)',
        });
      }

      const copySource = getCopySource(sourcePath, artifactType);
      const typeDir = ARTIFACT_TYPE_DIR_MAP[artifactType] ?? '';
      const destinationDir = path.join(os.homedir(), '.claude', typeDir);

      const result = await performCopy(sourcePath, destinationDir, artifactType, overwrite);

      if (result.success) {
        await fs.rm(copySource, { recursive: true, force: true });
      }

      return reply.send(result);
    }
  );

  // POST /api/operations/demote
  s.post(
    '/api/operations/demote',
    {
      schema: {
        body: DemoteRequestSchema,
        response: { 200: OperationResultSchema, 400: OperationResultSchema },
      },
    },
    async (req, reply) => {
      const { sourcePath, targetProjectDir, artifactType, overwrite } = req.body;

      if ((BLOCKED_TYPES as readonly string[]).includes(artifactType)) {
        return reply.code(400).send({
          success: false,
          error: 'This artifact cannot be demoted (managed within a JSON config file)',
        });
      }

      const copySource = getCopySource(sourcePath, artifactType);
      const typeDir = ARTIFACT_TYPE_DIR_MAP[artifactType] ?? '';
      // targetProjectDir is the .claude directory path (scope.rootPath from client)
      const destinationDir = path.join(targetProjectDir, typeDir);

      const result = await performCopy(sourcePath, destinationDir, artifactType, overwrite);

      if (result.success) {
        await fs.rm(copySource, { recursive: true, force: true });
      }

      return reply.send(result);
    }
  );

  // POST /api/operations/preflight
  s.post(
    '/api/operations/preflight',
    {
      schema: {
        body: PreflightRequestSchema,
        response: { 200: PreflightResultSchema },
      },
    },
    async (req, reply) => {
      const { sourcePath, artifactType } = req.body;
      const copySource = getCopySource(sourcePath, artifactType);
      const refWarnings = await scanReferences(copySource);

      // Add semantic warnings for special types
      const typeWarning = WARNING_MESSAGES[artifactType];
      if (typeWarning) {
        refWarnings.push({ type: 'semantic', message: typeWarning });
      }

      return reply.send({ warnings: refWarnings });
    }
  );

  // POST /api/operations/describe
  s.post(
    '/api/operations/describe',
    {
      schema: {
        body: DescribeRequestSchema,
        response: { 200: DescribeResultSchema },
      },
    },
    async (req, reply) => {
      try {
        const reqPath = req.body.path;

        // MCP config: path has #fragment pointing to server name in JSON
        if (reqPath.includes('#') && reqPath.endsWith('.json#' + reqPath.split('#').pop())) {
          const [filePath, serverName] = reqPath.split('#');
          const raw = await fs.readFile(filePath, 'utf-8');
          const json = JSON.parse(raw);

          // Try mcpServers.{name} (mcp.json format) or projects.*.mcpServers.{name} (.claude.json)
          const entry = json.mcpServers?.[serverName]
            ?? json[serverName]
            ?? Object.values(json.projects ?? {}).find((p: any) => p?.mcpServers?.[serverName])?.mcpServers?.[serverName];

          if (entry) {
            if (entry.url) {
              return reply.send({ description: `${entry.type ?? 'HTTP'} server: ${entry.url}` });
            }
            const cmd = entry.command ?? '';
            const args = (entry.args ?? []).join(' ');
            return reply.send({ description: `Runs: ${cmd} ${args}`.trim() });
          }
          return reply.send({ description: null });
        }

        const raw = await fs.readFile(reqPath, 'utf-8');
        const { data, content } = matter(raw);

        if (data.description) {
          return reply.send({ description: String(data.description) });
        }

        const firstParagraph = content.trim().split(/\n\n+/)[0]?.trim() ?? null;
        return reply.send({ description: firstParagraph || null });
      } catch {
        return reply.send({ description: null });
      }
    }
  );
}
