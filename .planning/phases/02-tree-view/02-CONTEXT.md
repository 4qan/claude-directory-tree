# Phase 2: Tree View - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Read-only interactive tree displaying all Claude artifacts organized by scope (global vs project), with search, type filtering, refresh, and scope labels. No file operations, no context menus, no keyboard navigation (those are Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Tree layout & hierarchy
- Scope-first organization: top level = Global, Project A, Project B...
- Each scope expands to show artifact category nodes (Agents, Commands, Skills, etc.)
- Each category expands to show individual artifacts
- Plugins render as a special category node under their parent scope, with internal artifacts (agents, commands, skills) as expandable children inside
- Default state on load: scopes expanded, categories collapsed
- Empty categories hidden (only show categories with at least one artifact)
- Empty scopes hidden entirely (projects with zero artifacts not shown)

### Icons, labels & badges
- Lucide SVG icons per artifact type (already installed via lucide-react)
- Icon mapping: Bot for agents, Terminal for commands, Zap for skills, Link for MCP, FileText for CLAUDE.md, etc.
- Scope badge: subtle muted text label ("global" / "project") next to scope name
- Artifact counts: parenthetical after category name, e.g., "Agents (3)"
- Artifact labels: name only (type implied by parent category and icon)

### Search & type filtering
- Top toolbar pinned above tree: search input + type filter dropdown
- Search matches artifact names only (not frontmatter or project names)
- Type filter is a dropdown listing all artifact types
- Search + type filter use AND logic (both conditions must match)
- Filtered tree preserves hierarchy (scope > category > artifact), hiding non-matching nodes
- No-match state: "No artifacts matching [query]" with a "Clear filters" link

### Empty & loading states
- Loading: skeleton tree with shimmer bars showing placeholder scope and category structure
- Empty tree (no projects found): centered guidance message, "No Claude artifacts found in [directory]" with hint about scan path
- No search matches: inline message with "Clear filters" action for quick recovery

### Claude's Discretion
- Exact lucide icon choices per artifact type
- Skeleton tree shimmer implementation details
- Refresh button placement and style
- Tree indentation spacing and expand/collapse chevron style
- Type filter dropdown component choice

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project docs
- `.planning/REQUIREMENTS.md` -- TREE-01 through TREE-08 define all tree view requirements
- `.planning/PROJECT.md` -- Constraints (sub-second startup, macOS primary, file-explorer feel)
- `.planning/ROADMAP.md` -- Phase 2 success criteria and requirement mapping

### Phase 1 foundation
- `.planning/phases/01-foundation/01-CONTEXT.md` -- Stack decisions, artifact classification rules, project discovery behavior
- `src/scanner/types.ts` -- Artifact, ScopeNode, ScanResponse schemas (data contract for tree)
- `src/server/routes/scan.ts` -- GET /api/scan endpoint (data source for tree)
- `client/src/App.tsx` -- Current placeholder UI to be replaced with tree view

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/ui/button.tsx`: shadcn Button component
- `client/src/components/ui/card.tsx`: shadcn Card/CardContent components
- `client/src/lib/utils.ts`: cn() utility for Tailwind class merging
- `lucide-react`: Icon library already installed
- `@headless-tree/react`: Tree component library decided in Phase 1 (may need installation)

### Established Patterns
- React 19 + Tailwind 4 + shadcn UI primitives
- Vite dev server with HMR for client
- Fetch-based API calls (see existing scan() in App.tsx)
- Zod schemas for API response validation (src/scanner/types.ts)

### Integration Points
- `GET /api/scan` returns `ScanResponse` with `ScopeNode[]` containing `Artifact[]` with children
- App.tsx currently owns scan state, needs to be restructured for tree view
- Tailwind theme tokens (bg-background, text-foreground, etc.) already configured

</code_context>

<specifics>
## Specific Ideas

- UI should feel like a native file explorer (VS Code sidebar, macOS Finder) per PROJECT.md
- The tree replaces the current placeholder status card in App.tsx
- Toolbar pattern (search + filter pinned at top) mirrors VS Code file explorer

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>

---

*Phase: 02-tree-view*
*Context gathered: 2026-03-28*
