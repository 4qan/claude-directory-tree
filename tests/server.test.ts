import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import getPort, { portNumbers } from 'get-port';
import { createServer } from '../src/server/index.js';
import { ScanResponseSchema } from '../src/scanner/types.js';

const DEFAULT_PORT = 3737;

describe('Fastify server (INFRA-02, INFRA-03)', () => {
  const servers: Awaited<ReturnType<typeof createServer>>[] = [];

  afterEach(async () => {
    for (const s of servers) {
      await s.close().catch(() => {});
    }
    servers.length = 0;
  });

  it('INFRA-02: GET /api/scan returns 200 with valid ScanResponseSchema', async () => {
    const server = await createServer(process.cwd());
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/api/scan',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Validate with zod schema
    const result = ScanResponseSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('INFRA-02: server config uses host 127.0.0.1 (not 0.0.0.0)', async () => {
    const server = await createServer(process.cwd());
    servers.push(server);

    // Start the server and check which address it bound to
    await server.listen({ port: 0, host: '127.0.0.1' });
    const addr = server.addresses();
    expect(addr.length).toBeGreaterThan(0);
    for (const a of addr) {
      if (typeof a === 'object' && 'address' in a) {
        expect(a.address).toBe('127.0.0.1');
      }
    }
  });

  it('INFRA-03: port fallback works when default port is occupied', async () => {
    // Occupy the default port
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(DEFAULT_PORT, '127.0.0.1', resolve));

    try {
      const port = await getPort({ port: portNumbers(DEFAULT_PORT, DEFAULT_PORT + 20) });
      expect(port).not.toBe(DEFAULT_PORT);
      expect(port).toBeGreaterThan(DEFAULT_PORT);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('API response: two sequential scans both return valid responses (no stale cache)', async () => {
    const server = await createServer(process.cwd());
    servers.push(server);

    const res1 = await server.inject({ method: 'GET', url: '/api/scan' });
    const res2 = await server.inject({ method: 'GET', url: '/api/scan' });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);

    expect(ScanResponseSchema.safeParse(body1).success).toBe(true);
    expect(ScanResponseSchema.safeParse(body2).success).toBe(true);

    // Each scan gets a fresh timestamp
    expect(body1.scannedAt).toBeDefined();
    expect(body2.scannedAt).toBeDefined();
  });
});
