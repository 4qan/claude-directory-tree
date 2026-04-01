import staticPlugin from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve client assets dir: works from dist/cli.js (sibling) and dist/server/index.js (parent)
const clientRoot = existsSync(join(__dirname, 'client', 'index.html'))
  ? join(__dirname, 'client')
  : join(__dirname, '..', 'client');

export async function registerStatic(server: FastifyInstance) {
  await server.register(staticPlugin, {
    root: clientRoot,
    prefix: '/',
    wildcard: false,
  });

  // SPA fallback: serve index.html for all non-API routes
  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}
