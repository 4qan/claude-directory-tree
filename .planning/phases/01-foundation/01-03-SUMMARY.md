---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [fastify, react, vite, tailwind, shadcn, typescript, cli, get-port, open]

requires:
  - phase: 01-foundation-01
    provides: Scanner types (ScanResponseSchema, runScan), tsup/vitest config
  - phase: 01-foundation-02
    provides: Artifact scanner (runScan), config/projects.ts (addProject), scanner tests

provides:
  - Fastify 5 server factory (createServer/startServer) binding to 127.0.0.1
  - GET /api/scan route with zod-typed response (fresh runScan on each request)
  - @fastify/static SPA serving with SPA fallback for non-API routes
  - CLI entry point: arg parsing, port allocation, terminal scan output, browser open
  - React status page: loading/result/error states, Rescan button
  - shadcn Button and Card components (manual, offline installation)
  - Tailwind 4 via @tailwindcss/vite with shadcn CSS variable theme

affects: [phase-02-tree-view, phase-03-mcp]

tech-stack:
  added:
    - "@fastify/cors ^11.2.0 (dev CORS)"
    - "@fastify/static ^9.0.0 (SPA serving)"
    - "fastify-type-provider-zod ^6.1.0 (typed routes)"
    - "get-port ^7.2.0 (port allocation)"
    - "open ^11.0.0 (browser launch)"
    - "tailwindcss + @tailwindcss/vite (Tailwind 4 Vite integration)"
    - "lucide-react (spinner icon)"
    - "class-variance-authority + clsx + tailwind-merge (shadcn utilities)"
    - "@radix-ui/react-slot (shadcn Button primitive)"
  patterns:
    - "createServer exported separately from startServer for test injection without listening"
    - "scanRoutes takes targetDir param; each GET /api/scan calls runScan() fresh (no cache)"
    - "host: '127.0.0.1' hardcoded in startServer.listen() - never 0.0.0.0 or localhost"
    - "shadcn components installed manually (no network access during build)"
    - "Vite @ alias resolves to client/src for shadcn component imports"

key-files:
  created:
    - src/server/index.ts
    - src/server/routes/scan.ts
    - src/server/static.ts
    - client/index.html
    - client/tsconfig.json
    - client/src/main.tsx
    - client/src/App.tsx
    - client/src/App.css
    - client/src/lib/utils.ts
    - client/src/components/ui/button.tsx
    - client/src/components/ui/card.tsx
    - client/components.json
    - tests/server.test.ts
  modified:
    - src/cli.ts (replaced stub with full implementation)
    - vite.config.ts (added @tailwindcss/vite plugin and @ alias)
    - package.json (added tailwindcss, lucide-react, shadcn deps)

key-decisions:
  - "shadcn components created manually (offline) rather than via npx shadcn add (no network)"
  - "Tailwind 4 CSS variables for shadcn theme written into App.css with prefers-color-scheme media query"
  - "CORS only registered in development mode (NODE_ENV=development), not production"
  - "createServer/startServer split: createServer for test injection, startServer for production use"

patterns-established:
  - "Server pattern: createServer() returns Fastify instance without listening; startServer() calls listen()"
  - "Scan route pattern: fresh runScan() on every GET /api/scan (no result caching)"
  - "CLI pattern: port allocation -> terminal scan output -> startServer -> open browser"
  - "shadcn offline install: create components.json manually, write components from source"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04]

duration: 8min
completed: 2026-03-28
---

# Phase 01 Plan 03: Full-Stack Integration Summary

**Fastify server on 127.0.0.1 with typed GET /api/scan, CLI binary with port allocation and browser open, and React status page with loading/result/error states and Rescan button**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-28T15:30:00Z
- **Completed:** 2026-03-28T15:38:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 13 created, 3 modified

## Accomplishments

- Fastify server with zod type provider, GET /api/scan returning ScanResponseSchema on every call
- CLI binary: arg parsing (positional dir + --add flag), port fallback with notice, terminal scan summary, browser open via `open` package
- React status page: three states per UI-SPEC, shadcn Button/Card components, Tailwind 4 theme
- All 4 server tests pass (INFRA-02, INFRA-03, API response validation, rescan freshness)
- Full build (`npm run build`) exits 0, producing `dist/cli.js` and `client/dist/index.html`

## Task Commits

1. **Task 1: Fastify server, scan route, CLI, server tests** - `9eeec46` (feat)
2. **Task 2: React status page** - `fb530cb` (feat)

## Files Created/Modified

- `src/server/index.ts` - Fastify factory with zod type provider, 127.0.0.1 binding
- `src/server/routes/scan.ts` - GET /api/scan triggering fresh runScan on each request
- `src/server/static.ts` - @fastify/static SPA serving with SPA fallback
- `src/cli.ts` - Full CLI: arg parsing, port allocation, scan output, startServer, browser open
- `tests/server.test.ts` - INFRA-02/INFRA-03 tests + API response validation
- `client/src/App.tsx` - Three-state status page (loading/result/error) with Rescan button
- `client/src/App.css` - Tailwind 4 import + shadcn CSS variable theme (light + dark)
- `client/src/components/ui/button.tsx` - shadcn Button component
- `client/src/components/ui/card.tsx` - shadcn Card + CardContent components
- `vite.config.ts` - Added @tailwindcss/vite plugin and @ alias for client/src

## Decisions Made

- **shadcn offline install:** No network access during execution, so components.json was created manually and Button/Card components were written from source rather than fetched via `npx shadcn add`. Functionally identical.
- **Tailwind 4 CSS variables:** shadcn theme CSS variables written directly into App.css with both explicit `.dark` class and `prefers-color-scheme: dark` media query for automatic dark mode.
- **createServer/startServer split:** Separating server factory from server start enables `server.inject()` in tests without binding a port.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn add failed due to no network access**
- **Found during:** Task 2 (React status page)
- **Issue:** `npx shadcn add button card` failed with `getaddrinfo ENOTFOUND ui.shadcn.com`
- **Fix:** Created `components.json` manually, wrote Button and Card components directly from shadcn source patterns. Installed required peer deps (tailwindcss, lucide-react, class-variance-authority, clsx, tailwind-merge, @radix-ui/react-slot) via npm which resolved from local registry.
- **Files modified:** client/components.json, client/src/components/ui/button.tsx, client/src/components/ui/card.tsx, client/src/lib/utils.ts, package.json
- **Verification:** `npm run build:client` exits 0; components render correctly in built output
- **Committed in:** fb530cb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** shadcn components are functionally equivalent to what `npx shadcn add` would have produced. No scope creep.

## Issues Encountered

- Tailwind 4 requires `@tailwindcss/vite` plugin (not the traditional PostCSS config). Added the plugin to vite.config.ts and installed the package.

## Next Phase Readiness

- All Phase 1 INFRA requirements met (INFRA-01 through INFRA-04)
- `npm run build` exits 0 (server + client)
- `npx vitest run tests/server.test.ts` exits 0 (4 tests pass)
- Ready for human verification checkpoint (Task 3): run `node dist/cli.js ~/Projects` and verify browser opens with working status page
- Phase 2 (tree view) can proceed after checkpoint approval

---
*Phase: 01-foundation*
*Completed: 2026-03-28*
