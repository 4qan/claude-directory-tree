# Architecture Research

**Domain:** Local web app (npx-distributed file explorer)
**Researched:** 2026-03-28
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      npx Entry Point                            │
│  bin/cli.js  →  start Express server  →  open browser          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ localhost:PORT
┌───────────────────────────▼─────────────────────────────────────┐
│                       Express Server                            │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │   Static Assets  │  │            REST API                │  │
│  │  (Vite build)    │  │  /api/scan  /api/move  /api/open   │  │
│  └──────────────────┘  └────────────────┬───────────────────┘  │
└────────────────────────────────────────┼────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────┐
│                        Core Services                            │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Scanner         │  │ File Ops       │  │ Artifact Parser│  │
│  │  (fs walk)       │  │ (copy/move)    │  │ (type detect)  │  │
│  └──────────────────┘  └────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────┐
│                     Filesystem (local only)                     │
│  ~/.claude/          <project>/.claude/          settings.json  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      React UI (browser)                         │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │  Tree View   │  │  Context Menu   │  │  Hover Summary    │  │
│  │  Component   │  │  Component      │  │  Panel            │  │
│  └──────┬───────┘  └────────┬────────┘  └───────────────────┘  │
│         └───────────────────┴──────────────────────────────────  │
│                    Zustand State Store                          │
│            (artifact tree + selection + pending ops)           │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| CLI entry (`bin/cli.js`) | Parse args, bind port, start Express, launch browser | No business logic. Entry only. |
| Express server | Serve static UI build, expose REST API, route requests to services | No filesystem access directly. Delegates to services. |
| Scanner | Walk `~/.claude/` and discovered project `.claude/` dirs, build artifact tree | Read-only. Returns serializable data. Never writes. |
| Artifact Parser | Given a file path + context, determine artifact type and extract summary | Pure functions. No I/O. |
| File Ops | copy, move, delete, open-in-editor | Write access. Validates paths before acting. |
| React UI | Render tree, handle interactions, dispatch API calls | Never touches filesystem directly. All ops via API. |
| State Store (Zustand) | Hold artifact tree, selection state, pending operations, optimistic updates | Client-only. No persistence. |

## Recommended Project Structure

```
claude-directory-tree/
├── bin/
│   └── cli.js                  # npx entry point, arg parsing, browser launch
├── src/
│   ├── server/
│   │   ├── index.ts            # Express app setup, route registration
│   │   ├── routes/
│   │   │   ├── scan.ts         # GET /api/scan
│   │   │   ├── operations.ts   # POST /api/move, /api/copy, /api/delete
│   │   │   └── editor.ts       # POST /api/open
│   │   └── services/
│   │       ├── scanner.ts      # Filesystem walker, project discovery
│   │       ├── parser.ts       # Artifact type detection + summary extraction
│   │       └── fileOps.ts      # copy/move/delete + open-in-editor
│   ├── shared/
│   │   └── types.ts            # Artifact, Scope, ArtifactType — shared between server/client
│   └── client/
│       ├── main.tsx            # React entry point
│       ├── store/
│       │   └── artifacts.ts    # Zustand store: tree state, selections, ops
│       ├── components/
│       │   ├── TreeView/       # Recursive tree render, expand/collapse
│       │   ├── ContextMenu/    # Right-click menu, action dispatch
│       │   ├── HoverPanel/     # Artifact summary on hover/select
│       │   └── Toolbar/        # Refresh, scope toggle, search
│       └── api/
│           └── client.ts       # Typed fetch wrappers for all REST endpoints
├── vite.config.ts              # Build: outputs to dist/, server serves from there
├── tsconfig.json
└── package.json                # bin entry, dependencies
```

### Structure Rationale

- **`src/server/` vs `src/client/`**: Hard separation prevents client code from importing Node.js modules (fs, path). Vite enforces this boundary at build time.
- **`src/shared/types.ts`**: Single source of truth for the artifact data model. Both server serialization and client rendering reference this. Any schema change touches one file.
- **`services/` layer**: Routes are thin (validate, call service, return JSON). Services own all logic. This makes services independently testable without HTTP overhead.
- **`bin/cli.js`**: Plain CommonJS (not TypeScript) so it runs directly with `node` without a build step. Everything else is TypeScript compiled to `dist/`.

## Architectural Patterns

### Pattern 1: Thin Routes, Fat Services

**What:** API routes do only three things: parse request, call a service function, return response. No business logic in route handlers.
**When to use:** Always. This is the default for Express apps with testable logic.
**Trade-offs:** Slightly more files, but services are trivially unit-testable.

**Example:**
```typescript
// routes/operations.ts
router.post('/move', async (req, res) => {
  const { from, to } = req.body;
  const result = await fileOps.move(from, to);  // all logic in service
  res.json(result);
});
```

### Pattern 2: Optimistic UI with Server Confirmation

**What:** When user triggers a move/copy, immediately update the client tree (optimistic), fire the API call, and roll back if the call fails.
**When to use:** File operations (latency is perceptible on large trees). Do NOT use for destructive deletes.
**Trade-offs:** Slightly more complex state management; dramatically better perceived performance.

**Example:**
```typescript
// store/artifacts.ts
async function moveArtifact(from: string, to: string) {
  const snapshot = get().tree;             // save for rollback
  set(state => applyMove(state, from, to)); // optimistic update
  try {
    await api.move(from, to);
  } catch {
    set({ tree: snapshot });               // rollback
    toast.error('Move failed');
  }
}
```

### Pattern 3: Artifact Type Registry

**What:** A map of `ArtifactType → { detect: (path) => boolean, summarize: (content) => string }`. Each type registers its own detection and summary logic. The parser iterates the registry.
**When to use:** From the start. New artifact types are added by registering a new entry, not by editing a switch statement.
**Trade-offs:** Slightly indirect; pays off immediately when adding new types.

**Example:**
```typescript
// services/parser.ts
const registry: ArtifactTypeDefinition[] = [
  {
    type: 'skill',
    detect: (path) => path.includes('/skills/') && path.endsWith('.md'),
    summarize: (content) => extractFrontmatterDescription(content),
  },
  {
    type: 'command',
    detect: (path) => path.includes('/commands/') && path.endsWith('.md'),
    summarize: (content) => extractFirstLine(content),
  },
  // ...
];
```

## Data Flow

### Initial Load Flow

```
User runs: npx claude-directory-tree [root-dir]
    ↓
cli.js: bind port, start Express, open browser
    ↓
Browser loads React app
    ↓
App mounts → calls GET /api/scan?root=<dir>
    ↓
scanner.ts: walk ~/.claude/ + discover projects under root-dir
    ↓
parser.ts: classify each file, extract summary
    ↓
Return: ArtifactTree (nested JSON)
    ↓
Zustand store: set(tree)
    ↓
TreeView renders
```

### File Operation Flow

```
User: drag artifact or right-click → Move to [project]
    ↓
ContextMenu dispatches: store.moveArtifact(from, to)
    ↓
Store: optimistic update → tree reflects move immediately
    ↓
api.client.ts: POST /api/move { from, to }
    ↓
routes/operations.ts: validate paths, call fileOps.move()
    ↓
fileOps.ts: fs.rename() or fs.copyFile() + fs.unlink()
    ↓
200 OK → store confirms (no-op if optimistic was correct)
    or
4xx/5xx → store rolls back tree to snapshot, shows error
```

### Open in Editor Flow

```
User: click artifact node
    ↓
POST /api/open { path: "/abs/path/to/artifact.md" }
    ↓
server: exec `$EDITOR path` or fallback: `open path` (macOS) / `xdg-open path` (Linux)
    ↓
System editor launches (server responds 200 immediately, doesn't wait)
```

### Key Data Shapes

```typescript
// shared/types.ts

type ArtifactType =
  | 'skill' | 'agent' | 'command' | 'plugin' | 'hook'
  | 'claude-md' | 'mcp-server' | 'memory' | 'plan'
  | 'settings' | 'unknown';

type Scope = 'global' | 'project';

interface Artifact {
  id: string;           // stable: sha of absolute path
  path: string;         // absolute path on disk
  type: ArtifactType;
  scope: Scope;
  projectName?: string; // null for global scope
  name: string;         // filename without extension
  summary?: string;     // first line / frontmatter description
}

interface ArtifactTree {
  global: Artifact[];
  projects: Array<{
    name: string;
    rootPath: string;
    artifacts: Artifact[];
  }>;
}
```

## Scaling Considerations

This is a single-user local tool. Scale is measured in "number of projects" and "number of artifacts", not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-15 projects (target) | Synchronous scan on startup is fine. No caching needed. |
| 15-50 projects | Scan each project lazily (expand-on-demand in tree). Return project list first, artifact list on expand. |
| 50+ projects | Background scan with incremental updates via SSE or polling. Still no DB needed — in-memory is sufficient. |

**First bottleneck:** Startup scan time when root directory contains many non-project folders (e.g., scanning `~/Documents` with 200 folders). Fix: limit scan depth and skip folders that have no `.claude/` within 2 levels.

**Second bottleneck:** UI render with 500+ artifacts. Fix: virtualize the tree list (react-virtual). Not needed in v1.

## Anti-Patterns

### Anti-Pattern 1: Exposing fs Directly to the Client

**What people do:** Let the React app call Node's `fs` module via some bridge, or expose a generic `exec` endpoint.
**Why it's wrong:** Creates arbitrary filesystem access. Even local-only, this is a security footgun and makes the API surface unbounded.
**Do this instead:** Every file operation is an explicit, typed API endpoint. Routes validate that paths are within allowed roots (`~/.claude/` or registered project paths) before delegating.

### Anti-Pattern 2: Scanning on Every Request

**What people do:** Re-walk the filesystem on every API call to ensure freshness.
**Why it's wrong:** Disk I/O is slow; makes every interaction feel sluggish. v1 explicitly out-scopes real-time watching.
**Do this instead:** Scan once on startup (or on explicit refresh). Serve from in-memory tree. Add a manual "Refresh" button that re-triggers the scan.

### Anti-Pattern 3: Bundling CLI and UI in One Build

**What people do:** Compile everything into a single entry file, mixing server and client code.
**Why it's wrong:** Node.js modules (`fs`, `path`, `child_process`) cannot be bundled into browser code. Build fails or silently breaks.
**Do this instead:** Two separate build targets. `bin/cli.js` + `src/server/` are Node.js (not bundled or compiled with esbuild targeting node). `src/client/` is compiled by Vite targeting browser. Express serves the Vite output as static files.

### Anti-Pattern 4: Storing State in the Server

**What people do:** Maintain artifact tree state on the Express server between requests (module-level variables, singleton caches with complex invalidation).
**Why it's wrong:** Single-user local tool, but still: server state adds restart-sensitivity and makes testing harder. All persistent state is the filesystem itself.
**Do this instead:** Server is stateless between requests. On each scan request, walk the filesystem fresh. Client owns the UI state in Zustand.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| System editor | `$EDITOR` env var → `child_process.exec()`. Fallback: `open` (macOS), `xdg-open` (Linux), `start` (Windows) | Async fire-and-forget. Never await. |
| Filesystem | Node.js `fs/promises` + `path` throughout server | No third-party fs library needed at this scale |
| Browser launch | `open` npm package in cli.js | Thin wrapper handles cross-platform `open`/`xdg-open`/`start` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI → Express | Direct function call (same process) | `cli.js` imports and calls `startServer()` |
| Express routes → Services | Direct function call (same process) | No message passing needed |
| Server → Client | HTTP REST (JSON) | Clean boundary. SSE could be added later for refresh events. |
| Components → Store | Zustand hooks (`useArtifactStore`) | Store is the single source of truth for UI state |
| Store → Server | `src/client/api/client.ts` typed fetch wrappers | All HTTP calls go through one module, not scattered across components |

## Suggested Build Order

Dependencies determine sequence. Each phase should be independently shippable/testable.

1. **CLI + Express skeleton + Vite wiring** — nothing works yet, but the app starts, serves a placeholder page, and the build pipeline is proven.
2. **Scanner + Parser (server-side)** — filesystem walking and artifact classification, with unit tests. No UI. Test via `curl /api/scan`.
3. **Tree View UI + GET /api/scan** — read-only tree renders correctly. No file ops yet. This alone delivers the core value proposition (visibility).
4. **File operations: copy/move + POST /api/move** — write operations with path validation. Add optimistic updates in store.
5. **Context menu + keyboard shortcuts** — UX layer on top of existing operations.
6. **Hover summaries + promote/demote** — polish + the global-to-local promotion feature.
7. **Open in editor + manual refresh** — last integration point with external systems.

## Sources

- Architecture derived from standard Express + Vite + React patterns (HIGH confidence, well-established)
- npx distribution pattern from community npm packages (HIGH confidence)
- Zustand for client state: official docs at zustand.pmnd.rs (HIGH confidence)
- Optimistic update pattern: standard in React Query / Zustand community (HIGH confidence)

---
*Architecture research for: Local Claude artifact browser (npx-distributed)*
*Researched: 2026-03-28*
