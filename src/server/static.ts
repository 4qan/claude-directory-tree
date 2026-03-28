import staticPlugin from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function registerStatic(server: FastifyInstance) {
  await server.register(staticPlugin, {
    root: join(__dirname, '../client/dist'),
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
