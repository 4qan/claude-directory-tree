import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { scanRoutes } from './routes/scan.js';
import { registerStatic } from './static.js';

export interface StartOptions {
  port: number;
  targetDir: string;
}

export async function createServer(targetDir: string) {
  const server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // CORS only needed in dev when Vite runs on separate port
  if (process.env.NODE_ENV === 'development') {
    await server.register(cors, { origin: true });
  }

  await scanRoutes(server, targetDir);
  await registerStatic(server);

  return server;
}

export async function startServer(options: StartOptions) {
  const server = await createServer(options.targetDir);
  await server.listen({ port: options.port, host: '127.0.0.1' });
  return server;
}
