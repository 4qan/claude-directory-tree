# Project Research Summary

**Project:** Claude Directory Tree
**Domain:** npx-distributed local web app — Claude Code artifact file explorer
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

Claude Directory Tree is a zero-install CLI tool (`npx claude-directory-tree`) that launches a local browser UI for discovering, organizing, and moving Claude Code artifacts across scopes (global `~/.claude/` and per-project `.claude/`). The product fills a gap that no existing tool addresses: unified visibility across N project artifact directories plus first-class promote/demote between scopes. The standard build pattern is a Vite-built React SPA served by a Fastify server bundled via tsup, distributed as a single npm package with a `bin` entry. The React app runs in the browser; all filesystem operations go through a typed REST API.

The recommended approach is to build in dependency order: scaffold the build pipeline first, then filesystem scanning and artifact type detection server-side, then a read-only tree UI, and only then add write operations (copy/move). This order is critical because the artifact type registry must exist before copy/move is implemented — treating all Claude artifacts as flat files causes silent data loss (skills are directories, MCP entries have path references, hooks carry script dependencies). Every file write must use atomic temp-then-rename semantics from the start.

The primary risks are data integrity and distribution mechanics. Settings file corruption during concurrent Claude Code sessions, non-atomic move operations, and overly broad directory scans are the failure modes most likely to erode user trust fast. The npx distribution layer adds its own surface: port conflicts on second launch, stale cache serving old versions, and orphan server processes. Both categories have well-understood mitigations, but all of them must be addressed before the first public release — not deferred.

## Key Findings

### Recommended Stack

The stack is purpose-fit for a local tool distributed via npx. Fastify 5 (not Express) is preferred for its TypeScript ergonomics and first-party plugin model; Express is acceptable only if contributor familiarity demands it. The frontend is Vite 8 + React 19 + Tailwind CSS 4, targeting the VS Code sidebar aesthetic via headless-tree for the artifact tree (virtualized, bring-your-own-markup, actively maintained). The server is bundled by tsup into `dist-server/`; the client into `dist/`. The entire package ships these two directories and a `bin` entry.

**Core technologies:**
- Fastify 5.8.4: HTTP server — faster than Express, better TypeScript types, first-party static file plugin
- React 19.2.4: UI framework — only ecosystem with production-ready virtualized tree components
- TypeScript 6.0.2: Type safety — required for cross-platform path logic and artifact schema correctness
- Vite 8.0.3: Frontend build — current standard, Rolldown+Oxc under the hood
- Tailwind CSS 4.2.2: Styling — utility-first, no component library opinions to fight
- @headless-tree/react 1.6.3: Tree view — headless/virtualized, React 19 compatible, actively maintained
- open 11.0.0 (ESM-only): Browser launch — cross-platform wrapper; requires `"type": "module"` in package.json
- tsup: Server bundle — wraps esbuild for Node CLI targets, simpler than manual config

**Version constraints that matter:** Fastify 5 requires Node 20+; `@vitejs/plugin-react` v6 requires Vite 8; `open` v11 is ESM-only (no CJS mixing).

### Expected Features

The MVP is well-defined by research. The core differentiator is unified multi-project tree view — no competing tool (VS Code Explorer, Finder) unifies global and per-project artifact scopes. Everything else builds on top of that.

**Must have (table stakes for v1):**
- Unified tree view (global scope + per-project scopes) — primary value proposition
- Auto-scan parent directory for projects with `.claude/` folders
- Artifact type detection and icons (skills, agents, commands, hooks, CLAUDE.md, MCP configs, memory)
- Click to open in system editor
- Right-click context menu with type-specific actions
- Copy/move artifacts between scopes and projects (with conflict detection)
- Promote/demote (scope change) as a first-class action
- Search/filter by name
- Manual refresh

**Should have (add post-validation in v1.x):**
- Filter by artifact type (cross-project queries like "all agents")
- Inline artifact summary on hover (parse frontmatter/first paragraph)
- Real-time file watching (chokidar + SSE)
- Scope conflict detection (shadowing warnings)

**Defer to v2+:**
- Multi-select batch operations — too complex before single-item flows are proven
- Keyboard shortcut cheat-sheet / command palette
- Project tagging/grouping

**Anti-features to avoid:** inline editor (recreates a worse VSCode), artifact creation wizards (out of scope for an organizer), cloud sync, diff/merge.

### Architecture Approach

The architecture is a clean two-build, two-runtime split: Fastify server (Node.js, bundled by tsup) serves the Vite SPA and exposes a REST API. The server is stateless between requests — the filesystem is the source of truth, and the client holds UI state in Zustand. Three server-side services handle all logic: Scanner (read-only fs walk), Artifact Parser (pure type/summary detection), and FileOps (validated writes). Routes are thin wrappers that delegate immediately to services. `src/shared/types.ts` is the single definition of the artifact data model shared by both runtimes.

**Major components:**
1. CLI entry (`bin/cli.js`) — port binding, server start, browser launch via `open`; no business logic
2. Fastify server — static asset serving + REST API routing; delegates all logic to services
3. Scanner service — async fs walk with depth limits, skip list, symlink cycle detection; read-only
4. Artifact Parser service — pure functions; type registry pattern (detect + summarize per type)
5. FileOps service — validated path operations; atomic writes; copy-verify-then-delete order
6. React UI — tree view, context menu, toolbar; all operations via typed fetch wrappers in `api/client.ts`
7. Zustand store — artifact tree, selection, optimistic updates with snapshot-based rollback

### Critical Pitfalls

1. **Non-atomic settings file writes** — `fs.writeFile` truncates before writing; Claude Code reads the file concurrently. Use `write-file-atomic` (temp-then-rename) for every settings file mutation. Never use `fs.writeFile` directly on any `.json` config file.
2. **Treating all artifacts as flat files** — skills are directories (SKILL.md + scripts/), MCP entries contain absolute paths, hooks reference external scripts. A generic copy function causes silent data loss. Build the artifact type registry before implementing copy/move.
3. **Non-atomic move (delete before verify)** — `copy() + delete()` without verifying destination integrity causes irreversible data loss. Order must be: write destination, verify it parses correctly, then delete source.
4. **Directory scan without bounds** — scanning `~/Documents` with no depth limit or skip list (no `node_modules`, `.git`) hangs the UI. Use async `fs.promises.readdir`, max depth 2-3, skip list enforced from day one.
5. **npx port conflicts and orphan processes** — hardcoded port 3000 breaks on second launch. Use dynamic port allocation (`get-port`), lock file for process detection, bind to `127.0.0.1` (not `localhost`), register SIGINT/SIGTERM handlers.
6. **Path handling cross-platform** — `~/` string literals and `process.env.HOME` break on Windows. Use `os.homedir()` and `path.join()` everywhere, enforced as shared path utilities from project scaffolding.
7. **Surgical settings.json edits** — `Object.assign` on the full settings object silently drops unrelated keys (permissions, pluginConfigs). Read file, touch only the target key, write back atomically.

## Implications for Roadmap

Based on research, 7 phases in dependency order:

### Phase 1: Project Scaffolding and Build Pipeline
**Rationale:** Everything depends on this. The two-build architecture (Vite client + tsup server) must be proven before any feature work begins. ESM-only constraints and TypeScript config must be settled here.
**Delivers:** `npx claude-directory-tree` starts a server, opens a browser, shows a placeholder page. Build pipeline is verified end-to-end.
**Uses:** Fastify, Vite 8, tsup, TypeScript, `"type": "module"` throughout
**Avoids:** Anti-Pattern 3 (mixing CLI and UI builds); `open` ESM-only constraint; path utility setup from day one

### Phase 2: Artifact Type System and Scanner (Server-Side)
**Rationale:** The type registry is a hard prerequisite for copy/move. Building it before the UI means it can be tested in isolation via `curl /api/scan`. Any type detection gaps surface here, not after UI is built.
**Delivers:** `GET /api/scan` returns a fully typed `ArtifactTree` JSON. All artifact types detected. Unit tests covering each type's detection and copy unit definition.
**Uses:** Scanner service, Artifact Parser service, `src/shared/types.ts`, `fs.promises` throughout (never sync)
**Avoids:** Treating all artifacts as flat files (Pitfall 2); synchronous scan blocking event loop (Pitfall 8); path handling issues (Pitfall 4)

### Phase 3: Read-Only Tree UI
**Rationale:** The read-only view delivers the core value proposition (visibility across all scopes). It's independently shippable and validates the tree component choice before adding write complexity.
**Delivers:** Fully functional artifact tree: expand/collapse, scope labels, artifact type icons, search/filter by name, manual refresh. No write operations yet.
**Uses:** @headless-tree/react, Zustand, Tailwind CSS, React 19
**Avoids:** Rendering performance trap — enable TanStack Virtual if 500+ nodes visible

### Phase 4: Core File Operations (Copy/Move/Promote/Demote)
**Rationale:** Write operations are the highest-risk phase. Atomic writes, type-aware copy logic, and conflict detection must all be correct together. This phase requires the type registry from Phase 2 to be complete.
**Delivers:** Right-click context menu with copy, move, promote to global, demote to project. Conflict detection. Optimistic UI updates with rollback.
**Uses:** FileOps service, `write-file-atomic`, Zustand optimistic update pattern
**Avoids:** Non-atomic move (Pitfall 3); settings.json corruption (Pitfall 1); surgical-only settings edits (Pitfall 7)

### Phase 5: npx Distribution Hardening
**Rationale:** The tool is usable locally but not safe to publish. Port management, process lifecycle, and package metadata must be addressed before public release.
**Delivers:** Dynamic port allocation, lock file for second-instance detection, SIGINT/SIGTERM cleanup, version display at startup, `bin` execute bit verified, `files` field in package.json correct.
**Uses:** `get-port` npm package, process signal handling
**Avoids:** Port conflicts/orphan processes (Pitfall 5); npx stale cache (Pitfall 6)

### Phase 6: Security and Open in Editor
**Rationale:** localhost binding and CSRF protection are quick wins that prevent low-effort attacks before the tool is in the wild. Editor integration completes the core workflow.
**Delivers:** Server bound to `127.0.0.1`. CSRF token on mutation endpoints. Origin header check. Path traversal validation (all paths must be within allowed roots). Open in editor via `$EDITOR` with `execa` (no shell injection).
**Uses:** `execa` for shell-safe process spawning
**Avoids:** Security mistakes (serving on 0.0.0.0, path traversal, command injection)

### Phase 7: Polish and v1.x Features
**Rationale:** After core is stable and validated, layer in features that reduce friction but are not blocking.
**Delivers:** Filter by artifact type, inline artifact summary on hover (lazy-parsed, not on startup), scope conflict detection (shadowing warnings), UX confirmations before destructive operations, toast notifications with undo, empty states.
**Uses:** Frontmatter/markdown parsing for summaries (lazy)
**Avoids:** Startup performance trap (parsing all file summaries eagerly)

### Phase Ordering Rationale

- Phases 1-2 are non-negotiable prerequisites. No UI work should start before the build pipeline is proven and the type system exists.
- Phase 3 (read-only) before Phase 4 (write) is critical: write operations require type awareness to be correct, and the tree must render correctly before optimistic updates are meaningful.
- Phase 5 (distribution) before public release but after core is functional — not a last-minute concern.
- Phase 6 (security) belongs before v1 public release, not deferred.
- Phase 7 is the only phase that could be partially deferred to v1.x without blocking initial release.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** MCP settings.json schema is partially documented. Confirm the exact key structure for `mcpServers`, `permissions`, `pluginConfigs`, and `enabledPlugins` before implementing surgical edits. The `.mcp.json` vs `settings.json` ownership rules need verification against current Claude Code docs.
- **Phase 5:** npx stale cache behavior is a known npm bug (npm/cli#5262) with medium-confidence mitigation. Verify current npm behavior and whether a startup version-check is feasible without adding latency.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Standard Vite + Fastify + tsup wiring — well-documented, no unknowns.
- **Phase 3:** Tree view with headless-tree is well-documented; component API is stable.
- **Phase 6:** `127.0.0.1` binding, CSRF token, `execa` — all standard patterns with clear docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions npm-verified live on 2026-03-28. ESM constraints and version compatibility explicitly confirmed. |
| Features | HIGH (core UX), MEDIUM (Claude-specific) | Core file explorer UX patterns are well-established. Claude artifact structure confirmed via official docs but schema details (especially settings.json internals) warrant validation. |
| Architecture | HIGH | Standard Express/Fastify + Vite + React patterns. Well-established. Two-build pipeline is industry-standard for this type of tool. |
| Pitfalls | HIGH (most), MEDIUM (npx caching) | Atomic write, path handling, and filesystem pitfalls are grounded in official docs and confirmed behavior. npx stale cache bug (npm/cli#5262) is real but mitigation confidence is medium. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude settings.json schema completeness:** Research confirms the top-level key names (`mcpServers`, `permissions`, `pluginConfigs`, `enabledPlugins`) but the full schema for each scope (user/project/local) needs validation before Phase 4 surgical-edit implementation. Do not infer — read the current official docs.
- **Skills directory structure:** Confirmed as `skills/<name>/SKILL.md` with optional `scripts/` and `reference.md`, but whether additional subdirectory conventions exist (e.g., for multi-file skills) needs confirmation during Phase 2.
- **Windows CI:** No Windows testing in research phase. Cross-platform path handling is well-reasoned, but `os.homedir()` and `path.join()` usage must be verified with actual Windows test runs in Phase 1.
- **headless-tree React 19 compat:** Inferred from recent publish date (Jan 2026) and version number; not explicitly stated in the library's docs. Verify at project setup.

## Sources

### Primary (HIGH confidence)
- npm registry (live, 2026-03-28) — all package versions
- [Fastify docs](https://fastify.dev/docs/latest/) — static serving, plugin model
- [Claude Code Settings docs](https://code.claude.com/docs/en/settings) — settings scope hierarchy, 4 scopes confirmed
- [Claude Code Plugins reference](https://code.claude.com/docs/en/plugins-reference) — artifact types, file locations
- [W3C ARIA Tree Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) — keyboard navigation standards
- [Node.js tilde expansion issue](https://github.com/nodejs/node/issues/684) — confirmed no built-in `~` expansion
- [write-file-atomic](https://github.com/npm/write-file-atomic) — atomic write pattern
- [cross-platform-node-guide](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/file_paths.md) — path handling

### Secondary (MEDIUM confidence)
- [headless-tree GitHub](https://github.com/lukasbach/headless-tree) — maintenance status, virtualization support
- [sindresorhus/open](https://github.com/sindresorhus/open) — ESM-only confirmed
- [Vite releases](https://vite.dev/releases) — v8 current
- WebSearch: react-arborist maintenance status (Snyk inactive flag, last publish Feb 2025)
- [npx stale cache bug](https://github.com/npm/cli/issues/5262) — MEDIUM confidence, known issue

### Tertiary (LOW confidence / inference)
- headless-tree React 19 compatibility — inferred from publish date, not explicitly documented

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
