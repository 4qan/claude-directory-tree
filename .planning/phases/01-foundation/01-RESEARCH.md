# Phase 1: Foundation - Research

**Researched:** 2026-03-28
**Domain:** Node.js CLI binary, Fastify 5 REST API, filesystem scanning, TypeScript build tooling
**Confidence:** HIGH

## Summary

This is a greenfield TypeScript project distributed as an npx binary. The user runs `npx claude-directory-tree [dir]`, the binary spins up a Fastify 5 HTTP server bound to 127.0.0.1, scans the filesystem for `.claude/` directories, classifies all artifacts within them, and opens the default browser. The server then serves the React SPA and a `GET /api/scan` endpoint that returns the full typed artifact tree.

The stack is already decided: Fastify 5, tsup, Vite 8, React 19, Tailwind 4, write-file-atomic. This phase only concerns the server binary and scanner — no UI work. The two-build split (tsup for server, Vite for client) means the client bundle is embedded as static files served by Fastify at runtime.

Phase 1 does NOT include the React tree view UI (that is Phase 2). The success criteria are: the binary launches, the browser opens, and `GET /api/scan` returns a correctly typed artifact tree. SCAN-02 (manual project registration) requires the JSON persistence file, but the UI trigger for it is out of scope for Phase 1.

**Primary recommendation:** Use native `fs.promises.readdir` with `{ withFileTypes: true, recursive: true }` (Node 20+) for scanning; `get-port` for dynamic port allocation; `open` (ESM-only) for browser launch; `fastify-type-provider-zod` for typed API responses; `gray-matter` for frontmatter parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Discovery:**
- CLI argument specifies the parent directory to scan: `npx claude-directory-tree ~/Projects`
- If no argument given, scan current working directory as fallback
- Unlimited scan depth (recursively find all `.claude/` directories), skipping `node_modules`, `.git`, and similar noise directories
- Global scope (`~/.claude/`) is always included automatically as a top-level node
- Manual project registration supported via both CLI flag (`--add /path`) and in-app UI button
- Registered projects persisted in a simple JSON file the app manages

**Startup Experience:**
- Verbose terminal output: list each discovered project with artifact count, then total summary and URL
- Auto-open browser after scan completes
- Auto-pick next available port if default is taken (print notice: "Port X in use, using Y")
- Persistent server: stays running until Ctrl+C, user can rescan anytime
- Rescan available via both browser refresh AND explicit rescan button in the UI

**Artifact Classification:**
- Detection uses both directory location AND frontmatter parsing for maximum accuracy
- Detection rules:
  - `/commands/*.md` -> Command (confirm via frontmatter)
  - `/agents/*.md` -> Agent (confirm via frontmatter)
  - `/skills/*.md` -> Skill (confirm via frontmatter)
  - `/hooks/` entries -> Hook (from settings.json)
  - `CLAUDE.md` -> CLAUDE.md (by name)
  - `.mcp.json` -> MCP config (by name)
  - `/memory/*.md` -> Memory file
  - `/plans/*.md` -> Plan file
  - `plugin.json` -> Plugin root
- Unclassifiable files shown as "Unknown" type (nothing hidden)
- Plugins are expanded to show their internal artifacts as children

### Claude's Discretion

- API response structure (nested tree vs flat list, field naming, pagination)
- Default port number
- JSON config file location and schema for persisted project registrations
- Skip-list for noise directories during recursive scan
- Frontmatter parsing strategy and fallback heuristics
- Error handling for inaccessible directories or permission issues

### Deferred Ideas (OUT OF SCOPE)

None. Discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | App launches via `npx claude-directory-tree` and opens localhost in browser | `bin` field in package.json + shebang; `open` package for browser launch |
| INFRA-02 | Server runs on localhost only, no network calls, no telemetry | Fastify `listen({ host: '127.0.0.1' })` — explicit, not default |
| INFRA-03 | Dynamic port allocation if default port is taken | `get-port` v7.2.0; fallback pattern documented below |
| INFRA-04 | Sub-second startup with instant tree rendering for 15+ projects | Async parallel scan per project; avoid synchronous readdir |
| SCAN-01 | Auto-discover all projects containing `.claude/` folders under a parent directory | Native `fs.promises.readdir` recursive; skip-list for noise dirs |
| SCAN-02 | User can manually register additional project paths | JSON persistence file managed by app; `write-file-atomic` for safe writes |
| SCAN-03 | Scanner detects all Claude artifact types | Directory-location + gray-matter frontmatter double-verification |
| SCAN-04 | Scanner distinguishes global scope (`~/.claude/`) from project scope (`.claude/`) | Scope flag in artifact tree node based on path prefix match |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.8.4 | HTTP server | Fastest Node.js framework; Node 20+ only aligns with our constraint |
| tsup | 8.5.1 | Server build (TypeScript -> JS) | Zero-config; wraps esbuild; standard for CLI npm packages |
| zod | 4.3.6 | Runtime schema + TypeScript types | Single source of truth for API shape; integrates with Fastify type provider |
| fastify-type-provider-zod | 6.1.0 | Bridges zod schemas into Fastify route types | Official Fastify ecosystem plugin |
| gray-matter | 4.0.3 | Frontmatter parsing for `.md` artifact files | Battle-tested; used by Gatsby, Astro, Vitepress |
| get-port | 7.2.0 | Find an available port dynamically | Pure ESM; zero dependencies; handles port conflicts |
| open | 11.0.0 | Open URL in default browser cross-platform | Pure ESM; uses `open` on macOS, `start` on Windows, `xdg-open` on Linux |
| write-file-atomic | 7.0.1 | Atomic writes for JSON config file | Temp-file + rename; prevents corruption on concurrent writes or SIGKILL |
| @fastify/static | 9.0.0 | Serve Vite client build output from disk | Official Fastify plugin |
| @fastify/cors | 11.2.0 | CORS headers for dev mode (Vite dev server -> Fastify) | Official Fastify plugin |

### Supporting (build-time only, no runtime cost)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | 8.0.3 | Client bundle (React SPA) | Client build only; separate from tsup |
| @vitejs/plugin-react | 6.0.1 | React Fast Refresh support in Vite | Paired with Vite |
| typescript | latest | Type checking | Both builds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| get-port | detect-port | get-port is pure ESM, lighter; detect-port is older CommonJS |
| gray-matter | manual regex | gray-matter handles edge cases (nested YAML, escaped delimiters); never hand-roll |
| Native fs.readdir recursive | fast-glob | Built-in is sufficient for finding `.claude/` dirs; fast-glob adds value for complex glob patterns (Phase 3+) |

**Installation (server dependencies):**
```bash
npm install fastify @fastify/static @fastify/cors fastify-type-provider-zod zod gray-matter get-port open write-file-atomic
npm install -D tsup typescript
```

**Installation (client dependencies):**
```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli.ts              # bin entry point — parse args, kick off startup
├── server/
│   ├── index.ts        # create + start Fastify instance
│   ├── routes/
│   │   └── scan.ts     # GET /api/scan route with zod schema
│   └── static.ts       # serve Vite build output via @fastify/static
├── scanner/
│   ├── index.ts        # orchestrate: discover projects + classify artifacts
│   ├── discover.ts     # recursive readdir to find .claude/ dirs
│   ├── classify.ts     # directory-location + frontmatter -> ArtifactType
│   └── types.ts        # zod schemas + TypeScript types for artifact tree
├── config/
│   └── projects.ts     # read/write persisted project registrations (JSON)
dist/
├── server/             # tsup output (CLI + server)
client/
├── dist/               # vite output (React SPA) — embedded in npm package
```

### Pattern 1: npx binary entry point
**What:** package.json `bin` field points to compiled `dist/cli.js`; file starts with `#!/usr/bin/env node`.
**When to use:** Every npm CLI package; npx handles shimming on Windows automatically.
**Example:**
```json
// package.json
{
  "bin": {
    "claude-directory-tree": "./dist/cli.js"
  },
  "type": "module"
}
```
```typescript
#!/usr/bin/env node
// src/cli.ts
import { startServer } from './server/index.js';
import { discoverProjects } from './scanner/discover.js';

const targetDir = process.argv[2] ?? process.cwd();
// ... startup sequence
```

### Pattern 2: Port allocation with fallback notice
**What:** Try preferred port first; fall back to next available; print notice when fallback is used.
**When to use:** Any local dev tool with a default port.
**Example:**
```typescript
// src/server/index.ts
import getPort, { portNumbers } from 'get-port';

const DEFAULT_PORT = 3737; // chosen: unlikely to conflict, memorable
const port = await getPort({ port: portNumbers(DEFAULT_PORT, DEFAULT_PORT + 20) });
if (port !== DEFAULT_PORT) {
  console.log(`Port ${DEFAULT_PORT} in use, using ${port}`);
}
await server.listen({ port, host: '127.0.0.1' });
```

### Pattern 3: Fastify with Zod type provider
**What:** Register zod type provider once; all routes get typed request/response automatically.
**When to use:** Any Fastify 5 project with TypeScript.
**Example:**
```typescript
import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod';

const server = Fastify().withTypeProvider<ZodTypeProvider>();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.get('/api/scan', {
  schema: { response: { 200: ScanResponseSchema } },
}, async () => {
  return await runScan();
});
```

### Pattern 4: Artifact tree API response structure (Claude's Discretion)
**Recommendation:** Flat list at the top level, with each entry being a `ScopeNode` (global or project), containing an `artifacts` array. Avoids deep nesting complexity, easy to filter on the client.
```typescript
// src/scanner/types.ts
import { z } from 'zod';

export const ArtifactTypeSchema = z.enum([
  'command', 'agent', 'skill', 'hook', 'claude-md',
  'mcp-config', 'memory', 'plan', 'plugin', 'unknown'
]);

export const ArtifactSchema = z.object({
  id: z.string(),          // deterministic: sha1 of absolutePath
  name: z.string(),
  type: ArtifactTypeSchema,
  absolutePath: z.string(),
  relativePath: z.string(), // relative to project root
  scope: z.enum(['global', 'project']),
  projectId: z.string(),
  frontmatter: z.record(z.unknown()).optional(),
});

export const ScopeNodeSchema = z.object({
  id: z.string(),
  label: z.string(),        // "Global (~/.claude)" or project dir name
  scope: z.enum(['global', 'project']),
  rootPath: z.string(),
  artifacts: z.array(ArtifactSchema),
  artifactCount: z.number(),
});

export const ScanResponseSchema = z.object({
  scannedAt: z.string(),   // ISO timestamp
  targetDir: z.string(),
  scopes: z.array(ScopeNodeSchema),
  totalArtifacts: z.number(),
});
```

### Pattern 5: Recursive scan with skip-list
**What:** Use `fs.promises.readdir` with `{ withFileTypes: true, recursive: true }` (Node 20+) to find all `.claude/` directories without external dependencies.
**When to use:** Simple directory trees with a fixed target extension/name.
```typescript
// src/scanner/discover.ts
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'vendor'
]);

async function findClaudeDirs(rootDir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // permission error — skip silently
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === '.claude') {
        results.push(fullPath);
        continue; // don't recurse INTO .claude dirs
      }
      await walk(fullPath);
    }
  }
  await walk(rootDir);
  return results;
}
```

### Pattern 6: Frontmatter-confirmed classification
**What:** Check directory path first (fast); confirm with frontmatter if ambiguous.
```typescript
// src/scanner/classify.ts
import matter from 'gray-matter';

function classifyByPath(filePath: string): ArtifactType | null {
  if (filePath.includes('/commands/') && filePath.endsWith('.md')) return 'command';
  if (filePath.includes('/agents/') && filePath.endsWith('.md')) return 'agent';
  if (filePath.includes('/skills/') && filePath.endsWith('.md')) return 'skill';
  if (filePath.includes('/memory/') && filePath.endsWith('.md')) return 'memory';
  if (filePath.includes('/plans/') && filePath.endsWith('.md')) return 'plan';
  if (path.basename(filePath) === 'CLAUDE.md') return 'claude-md';
  if (path.basename(filePath) === '.mcp.json') return 'mcp-config';
  if (path.basename(filePath) === 'plugin.json') return 'plugin';
  return null;
}

async function classifyFile(filePath: string): Promise<ArtifactType> {
  const byPath = classifyByPath(filePath);
  if (byPath && !filePath.endsWith('.md')) return byPath; // non-markdown: path is enough

  if (filePath.endsWith('.md')) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data } = matter(content);
      if (data.type) return data.type as ArtifactType; // frontmatter wins
    } catch { /* unreadable */ }
    return byPath ?? 'unknown';
  }
  return 'unknown';
}
```

### Pattern 7: Hooks from settings.json
**What:** Hooks are not standalone `.md` files; they live in `settings.json` as an array.
```typescript
// within classifyScope()
const settingsPath = path.join(claudeDir, 'settings.json');
try {
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
  const hooks = settings.hooks ?? [];
  // each hook entry becomes an ArtifactSchema with type: 'hook'
} catch { /* no settings.json */ }
```

### Anti-Patterns to Avoid
- **Binding to `0.0.0.0`:** Fastify's default may resolve to IPv6 `::1` on some systems. Always pass `host: '127.0.0.1'` explicitly to meet INFRA-02.
- **Synchronous readdir in startup path:** `readdirSync` blocks the event loop; use async readdir and `Promise.all` across projects for parallel scanning to meet INFRA-04.
- **Importing `open` with `require()`:** `open` v11+ is pure ESM. The whole project must use ESM (`"type": "module"` in package.json) or use dynamic `import()`.
- **Recursing into `.claude/` subdirectories during project discovery:** Once you find a `.claude/` dir, classify its contents; do not keep recursing into it looking for more `.claude/` dirs (there won't be any, and it wastes cycles).
- **Serving the React SPA with CORS headers in production:** `@fastify/cors` is only needed in dev mode when Vite dev server runs on a different port. In production, the SPA is served by Fastify itself, so no CORS is needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding an available port | Loop `net.createServer().listen()` | `get-port` | Edge cases: port released between check and bind (TOCTOU); get-port handles retry |
| Frontmatter parsing | Regex `---\n...\n---` | `gray-matter` | YAML escaping, nested values, encoding edge cases |
| Atomic JSON writes | `fs.writeFile` directly | `write-file-atomic` | Direct write corrupts file if process killed mid-write (SIGKILL, crash) |
| Cross-platform browser open | `child_process.exec('open ...')` | `open` | Windows needs `start`, Linux needs `xdg-open`; WSL detection is non-trivial |
| TypeScript API types from schema | Manual interface + Fastify generic | `fastify-type-provider-zod` | Single schema is both runtime validator and compile-time type |

**Key insight:** The complexity of cross-platform and edge-case behavior in these utilities far exceeds what they appear to be. Each of these has been battle-tested at scale.

## Common Pitfalls

### Pitfall 1: `open` is ESM-only
**What goes wrong:** `import open from 'open'` works in ESM, but if tsup is configured to output CJS, the `require('open')` fails at runtime with "ERR_REQUIRE_ESM".
**Why it happens:** `open` v10+ dropped CommonJS support.
**How to avoid:** Set `"type": "module"` in package.json and configure tsup to output ESM (`format: ['esm']`). The CLI entry point must end in `.js` (not `.cjs`).
**Warning signs:** `ERR_REQUIRE_ESM` at startup; or tsup outputting `.cjs` files.

### Pitfall 2: Fastify 5 requires full JSON schema for querystring/body
**What goes wrong:** Fastify v4 accepted shorthand schemas; v5 requires full `{ type: 'object', properties: {...} }`. The zod type provider handles this automatically, but mixing raw JSON schema with zod will cause startup errors.
**How to avoid:** Use zod schemas exclusively via `fastify-type-provider-zod` for all route definitions.

### Pitfall 3: `127.0.0.1` vs `localhost` hostname resolution
**What goes wrong:** On macOS, `localhost` may resolve to `::1` (IPv6) rather than `127.0.0.1`. If the server binds to `127.0.0.1` but the browser opens `http://localhost:PORT`, the connection fails on some macOS configurations.
**How to avoid:** Open the browser with `http://127.0.0.1:PORT`, not `http://localhost:PORT`. This aligns INFRA-02 (127.0.0.1 only binding) with the browser URL.

### Pitfall 4: Permissions errors during directory scan
**What goes wrong:** Some directories under `~/Projects` (system dirs, protected paths) throw `EACCES`. Without a try/catch, the scan crashes entirely.
**How to avoid:** Wrap each `readdir` call in try/catch; log a warning and skip that directory. Never let a single unreadable path abort the full scan.

### Pitfall 5: `write-file-atomic` Node.js version constraint
**What goes wrong:** `write-file-atomic` v7 requires Node `^20.17.0 || >=22.9.0`. If built on Node 20.0.0–20.16.x, install fails.
**How to avoid:** Pin `engines.node` in package.json to `>=20.17.0` to surface this requirement clearly to users.

### Pitfall 6: Vite client build path at runtime
**What goes wrong:** `@fastify/static` needs the absolute path to the Vite client dist directory. At runtime inside an npx package, `__dirname` is unreliable in ESM. Use `import.meta.url` + `fileURLToPath` instead.
**How to avoid:**
```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');
```

### Pitfall 7: `headless-tree` / React 19 compatibility
**What goes wrong:** STATE.md flags this: `@headless-tree/react` React 19 compatibility is not explicitly documented. This affects Phase 2, not Phase 1, but Phase 1 must set up the project structure correctly (dependencies installed, TypeScript configured) so it doesn't block Phase 2.
**How to avoid:** Verify `@headless-tree/react` peer dependency range during project setup (Phase 1, Wave 0). If incompatible, evaluate alternatives before Phase 2 planning begins.

## Code Examples

### Binary entry point (cli.ts)
```typescript
#!/usr/bin/env node
// src/cli.ts
import { startServer } from './server/index.js';
import { runScan } from './scanner/index.js';
import open from 'open';
import getPort, { portNumbers } from 'get-port';

const DEFAULT_PORT = 3737;
const targetDir = process.argv[2] ?? process.cwd();

const port = await getPort({ port: portNumbers(DEFAULT_PORT, DEFAULT_PORT + 20) });
if (port !== DEFAULT_PORT) {
  console.log(`Port ${DEFAULT_PORT} in use, using ${port}`);
}

const scanResult = await runScan(targetDir);

// Print verbose output
for (const scope of scanResult.scopes) {
  console.log(`  ${scope.label}: ${scope.artifactCount} artifacts`);
}
console.log(`\nTotal: ${scanResult.totalArtifacts} artifacts`);
console.log(`Open: http://127.0.0.1:${port}`);

await startServer({ port, scanResult });
await open(`http://127.0.0.1:${port}`);
```

### Fastify server setup
```typescript
// src/server/index.ts
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import cors from '@fastify/cors';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer({ port, scanResult }) {
  const server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Serve Vite SPA
  await server.register(staticPlugin, {
    root: join(__dirname, '../../client/dist'),
    prefix: '/',
  });

  // API routes
  server.get('/api/scan', {
    schema: { response: { 200: ScanResponseSchema } },
  }, async () => scanResult);

  await server.listen({ port, host: '127.0.0.1' });
}
```

### Persisted project registrations (SCAN-02)
```typescript
// src/config/projects.ts
import writeFileAtomic from 'write-file-atomic';
import { homedir } from 'os';
import { join } from 'path';
import fs from 'node:fs/promises';

// Stored at ~/.claude-directory-tree/projects.json
const CONFIG_DIR = join(homedir(), '.claude-directory-tree');
const CONFIG_FILE = join(CONFIG_DIR, 'projects.json');

export async function getRegisteredProjects(): Promise<string[]> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw).projects ?? [];
  } catch {
    return [];
  }
}

export async function addProject(absolutePath: string): Promise<void> {
  const existing = await getRegisteredProjects();
  if (existing.includes(absolutePath)) return;
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await writeFileAtomic(CONFIG_FILE, JSON.stringify({ projects: [...existing, absolutePath] }, null, 2));
}
```

### tsup configuration
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/server/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  target: 'node20',
  clean: true,
  dts: false, // CLI app, not a library
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node', // Only needed on cli.ts; handle selectively
  },
});
```
Note: The `#!/usr/bin/env node` shebang must only appear in `cli.js`, not in all output files. Use separate tsup configs or a post-build script to inject the shebang into only the CLI entry.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `opn` package | `open` package | 2019 | Same author; `open` is the successor |
| CommonJS (`require`) | ESM (`import`) | Node 12+ / 2022+ mainstream | Key deps (open, get-port) are ESM-only; project must be ESM |
| Manual port check with `net.createServer` | `get-port` | Ongoing | Handles TOCTOU race condition |
| Fastify shorthand schemas | Full JSON schema or zod | Fastify 5 (2024) | zod type provider is now the ergonomic path |
| `fs.readdirSync` recursive | `fs.promises.readdir` async | Node 20+ | Non-blocking; Node 22 adds `fs.promises.glob` but v20 `readdir` with recursive option is sufficient |
| `__dirname` in ESM | `fileURLToPath(import.meta.url)` | Node 12+ ESM | Required in ESM modules; `__dirname` is not defined |

**Deprecated/outdated:**
- `opn`: superseded by `open`
- CommonJS output from tsup: avoid for this project; all key runtime deps are ESM-only
- `portfinder`: older CJS package; `get-port` is the current standard

## Open Questions

1. **`@headless-tree/react` React 19 peer dep compatibility**
   - What we know: STATE.md flagged this as unverified
   - What's unclear: Whether it declares `react@^18` or `react@>=18` in peer deps
   - Recommendation: Run `npm info @headless-tree/react peerDependencies` during Wave 0 setup; if incompatible, evaluate `@tanstack/react-virtual` + custom tree or `react-arborist` as alternatives before Phase 2

2. **tsup shebang injection**
   - What we know: tsup's `banner.js` applies to ALL output files, not just cli.ts
   - What's unclear: Whether tsup supports per-entry banners in v8
   - Recommendation: Use a post-build `chmod + prepend` script, or maintain two tsup configs (one for cli.ts, one for server)

3. **Default port choice (Claude's Discretion)**
   - Recommendation: `3737` — above the well-known range, below ephemeral ports, not commonly used by other dev tools (3000, 3001, 4000, 5173 are all common)

4. **JSON config file location (Claude's Discretion)**
   - Recommendation: `~/.claude-directory-tree/projects.json` — follows XDG spirit without requiring XDG library; easy to find and manually edit

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via Vite ecosystem; pairs naturally with the project stack) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `bin` field resolves and shebang is present in cli.js | unit | `vitest run tests/cli.test.ts` | Wave 0 |
| INFRA-02 | Server binds to 127.0.0.1, not 0.0.0.0 | unit | `vitest run tests/server.test.ts` | Wave 0 |
| INFRA-03 | Occupied port triggers fallback to next available port | unit | `vitest run tests/server.test.ts` | Wave 0 |
| INFRA-04 | Scan of 15 empty project dirs completes in < 1000ms | unit | `vitest run tests/scanner.test.ts` | Wave 0 |
| SCAN-01 | `.claude/` dirs discovered recursively, noise dirs skipped | unit | `vitest run tests/scanner.test.ts` | Wave 0 |
| SCAN-02 | `addProject` persists to JSON; `getRegisteredProjects` reads it back | unit | `vitest run tests/config.test.ts` | Wave 0 |
| SCAN-03 | All artifact types classified correctly from fixture dirs | unit | `vitest run tests/classify.test.ts` | Wave 0 |
| SCAN-04 | Global scope (`~/.claude`) and project scope correctly flagged | unit | `vitest run tests/scanner.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — test framework config
- [ ] `tests/cli.test.ts` — covers INFRA-01
- [ ] `tests/server.test.ts` — covers INFRA-02, INFRA-03
- [ ] `tests/scanner.test.ts` — covers INFRA-04, SCAN-01, SCAN-04
- [ ] `tests/classify.test.ts` — covers SCAN-03
- [ ] `tests/config.test.ts` — covers SCAN-02
- [ ] `tests/fixtures/` — fixture `.claude/` directory structures for scanner tests

## Sources

### Primary (HIGH confidence)
- npm registry — fastify@5.8.4, tsup@8.5.1, zod@4.3.6, fastify-type-provider-zod@6.1.0, gray-matter@4.0.3, get-port@7.2.0, open@11.0.0, write-file-atomic@7.0.1, @fastify/static@9.0.0, @fastify/cors@11.2.0, vite@8.0.3, react@19.2.4, @vitejs/plugin-react@6.0.1 (verified via `npm view`)
- [Fastify v5 Migration Guide](https://fastify.dev/docs/v5.1.x/Guides/Migration-Guide-V5/) — breaking changes, full schema requirement, Node 20+ minimum
- [Fastify Server docs](https://fastify.dev/docs/latest/Reference/Server/) — `listen()` options including `host`
- [get-port npm](https://www.npmjs.com/package/get-port) — ESM-only, portNumbers helper
- [open GitHub](https://github.com/sindresorhus/open) — ESM-only since v10, cross-platform URL open
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic) — temp-rename pattern, Node 20.17+ requirement
- [gray-matter GitHub](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter parsing

### Secondary (MEDIUM confidence)
- [Fastify v5 breaking changes analysis](https://encore.dev/blog/fastify-v5) — zod type provider migration path
- [2ality.com: Node.js bin scripts](https://2ality.com/2022/08/installing-nodejs-bin-scripts.html) — shebang, cross-platform npm shimming
- [Node.js 22 fs.glob announcement](https://nodejs.org/en/blog/announcements/v22-release-announce) — built-in glob stable in 22.2.0 (not available in Node 20)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry live query
- Architecture: HIGH — patterns derived from official Fastify docs and established npm CLI conventions
- Pitfalls: HIGH for ESM/shebang/127.0.0.1 (verified); MEDIUM for headless-tree React 19 compatibility (unverified)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable ecosystem; Fastify 5 recently released so check for point releases)
