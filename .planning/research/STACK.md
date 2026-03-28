# Stack Research

**Domain:** npx-launched local web app with file explorer UI
**Researched:** 2026-03-28
**Confidence:** HIGH (versions npm-verified, all core choices confirmed against live registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Fastify | 5.8.4 | Node.js HTTP server | 3-4x faster than Express, built-in TypeScript types, first-party static file plugin. Overhead vs Express only matters for APIs at scale, but the TypeScript ergonomics and plugin model are genuinely better for a greenfield project in 2026. |
| React | 19.2.4 | UI framework | Standard choice for tree+context menu UIs. Ecosystem has the only production-ready tree components for this use case. No framework rivals it for component availability. |
| TypeScript | 6.0.2 | Type safety | Mandatory for an open-source tool accepting community contributions. Catches path/FS operation errors at compile time. |
| Vite | 8.0.3 | Frontend build | Current standard, ships Rolldown+Oxc under the hood in v8. `vite build` produces the `dist/` that Fastify serves. Uses `@vitejs/plugin-react` v6. |
| Tailwind CSS | 4.2.2 | Styling | Utility-first, no custom CSS maintenance. Makes the UI look like a native tool (VS Code sidebar aesthetic) without fighting a component library's opinions. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @headless-tree/react | 1.6.3 | Tree view component | Primary tree renderer. Headless (bring your own markup), virtualized, supports 100k+ nodes. Active maintenance (last publish Jan 2026). Use for the artifact tree. |
| @headless-tree/core | 1.6.3 | Tree view core logic | Peer dependency of @headless-tree/react. |
| @tanstack/react-virtual | latest | Virtualization | Use with headless-tree for long lists. headless-tree's docs explicitly support TanStack Virtual. Only needed if tree exceeds ~500 visible nodes. |
| open | 11.0.0 | Open files in system editor | Sindre Sorhus's cross-platform `open` package. Handles macOS `open`, Linux `xdg-open`, Windows `start`. **ESM-only** (type: module) -- package.json must use `"type": "module"` or use dynamic import. |
| @fastify/static | 9.0.0 | Serve bundled React app | Fastify first-party plugin. Serves `dist/` directory. Configure SPA fallback so all routes return `index.html`. |
| chokidar | latest | File watching (v2+) | Not for v1. If manual refresh isn't acceptable in a future milestone, chokidar is the standard Node.js fs watcher with cross-platform fixes. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @vitejs/plugin-react | v6.0.1 | React Fast Refresh in Vite | Uses Oxc transform in v6. Required for Vite 8 + React. |
| Vitest | latest | Unit testing | Co-located with Vite config, zero extra setup. Use for FS scanning logic and artifact detection. |
| tsup | latest | Bundle the Node.js server | Bundles the Fastify server + bin script into `dist-server/` as an ESM package. Simpler than Rollup for a Node CLI entry point. |
| pkgroll | alternative | Bundle server (alternative to tsup) | Lower config, similar outcome. Use tsup unless you hit issues. |

---

## Installation

```bash
# Core server
npm install fastify @fastify/static

# Core frontend
npm install react react-dom

# Tree component
npm install @headless-tree/react @headless-tree/core

# File opening
npm install open

# Dev dependencies
npm install -D vite @vitejs/plugin-react typescript tailwindcss vitest tsup
```

---

## Distribution Pattern (npx)

The npm package ships two things:

1. **`dist/`** -- Vite-built React SPA (HTML + JS + CSS)
2. **`dist-server/index.js`** -- tsup-bundled Fastify server, referenced in `package.json#bin`

```json
{
  "type": "module",
  "bin": {
    "claude-directory-tree": "./dist-server/index.js"
  },
  "files": ["dist/", "dist-server/"]
}
```

The server entry point:
1. Resolves `dist/` path relative to the package (not CWD)
2. Starts Fastify on a random available port
3. Calls `open("http://localhost:<port>")` to launch the browser
4. Serves the SPA and exposes a `/api` for file system operations

**Key constraint:** `dist/` must be bundled into the package. Use `__dirname`-equivalent (`import.meta.url` + `fileURLToPath`) to resolve the path to embedded assets at runtime.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify | Express | If contributors are Express-only and can't learn a new framework. Express 5.2 is current as of March 2026, so it's not stale -- just slower and less type-safe. |
| @headless-tree/react | react-arborist 3.4.3 | react-arborist is marked "Inactive" by Snyk, last published Feb 2025. It has React 19 compat but low commit cadence. Only use it if headless-tree's API proves too complex. |
| Tailwind CSS | CSS Modules | If contributors strongly resist utility CSS. CSS Modules ship with Vite out of the box. But Tailwind 4 is significantly leaner and better suited for VS Code sidebar aesthetics. |
| Vite 8 | esbuild-only (no framework) | If startup time becomes critical and the React bundle is a bottleneck. Unlikely for a local tool. |
| tsup | esbuild manually | tsup wraps esbuild with sensible defaults for Node CLI bundling. Manual esbuild config is unnecessary complexity. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron | 200MB+ runtime, defeats "zero install via npx" entirely | Fastify + browser |
| Next.js / Remix | Server-side rendering overhead, complex build pipeline, unnecessary for a local tool | Vite SPA + Fastify |
| Create React App | Unmaintained since 2022, webpack-based, slow | Vite 8 |
| Material UI / Ant Design | Ships large tree components that fight customization. Artifact tree needs VS Code sidebar feel, not Material Design. | Tailwind + headless-tree (render your own nodes) |
| CommonJS (`require`) | `open` v11 is ESM-only. Mixing CJS and ESM creates dynamic-import hacks throughout the server code. | ESM throughout (`"type": "module"`) |
| sqlite / any DB | No persistence layer needed. Artifacts are files. Read from disk on each request (or cache in memory). | Node.js `fs` module directly |
| Socket.IO / WebSockets | Overkill for v1. File operations are request/response. | REST API via Fastify |

---

## Stack Patterns by Variant

**If file watching is added (v2+):**
- Add `chokidar` to the server
- Push change events via Fastify's built-in SSE support (no Socket.IO needed)
- Frontend subscribes to `/api/watch` with EventSource

**If Windows compatibility breaks `open`:**
- `open` 11.x handles Windows via `start` command natively -- this should not require a workaround
- If it does, fall back to `child_process.spawn` with platform detection

**If the tree renders slowly on large projects (500+ artifacts):**
- Enable TanStack Virtual inside the headless-tree renderer
- headless-tree's flat-list output is already designed for this

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @vitejs/plugin-react@6 | Vite@8, React@19 | Plugin v6 requires Vite 8. Don't mix with older Vite. |
| @headless-tree/react@1.6 | React@18+, React@19 | Verified React 19 compat per recent publish date. |
| open@11 | Node.js 18+ | ESM-only. Requires `"type": "module"` in package.json or dynamic import. |
| Fastify@5 | Node.js 20+ | Fastify 5 dropped Node 18 support. Use Node 20 as minimum engine. |
| Tailwind CSS@4 | PostCSS 8+ | Tailwind 4 uses a new engine -- no `tailwind.config.js` by default. Configure via CSS `@import` instead. |

---

## Sources

- npm registry (live) -- versions for all packages verified 2026-03-28
- [Fastify docs](https://fastify.dev/docs/latest/) -- static serving, plugin model
- [headless-tree GitHub](https://github.com/lukasbach/headless-tree) -- maintenance status, virtualization support
- [Vite releases](https://vite.dev/releases) -- v8 confirmed current
- [sindresorhus/open](https://github.com/sindresorhus/open) -- ESM-only confirmed
- WebSearch: react-arborist maintenance status (Snyk inactive flag, last publish Feb 2025) -- MEDIUM confidence
- WebSearch: Fastify vs Express 2025 performance comparison -- MEDIUM confidence

---

*Stack research for: npx-launched local web app, Claude artifact file explorer*
*Researched: 2026-03-28*
