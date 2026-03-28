import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ScanResponseSchema } from '../../scanner/types.js';
import { runScan } from '../../scanner/index.js';

export async function scanRoutes(
  server: FastifyInstance & { withTypeProvider: () => FastifyInstance },
  targetDir: string
) {
  (server as FastifyInstance).withTypeProvider<ZodTypeProvider>().get(
    '/api/scan',
    {
      schema: {
        response: { 200: ScanResponseSchema },
      },
    },
    async () => {
      return await runScan(targetDir);
    }
  );
}
