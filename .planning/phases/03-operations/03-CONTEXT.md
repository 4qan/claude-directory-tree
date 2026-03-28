# Phase 3: Operations - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

File copy/move/promote/demote with full server-side implementation, context menu, keyboard navigation, and artifact summaries in a detail panel. Users can open, copy, move, promote, and demote artifacts without leaving the app, and see what each artifact does via a side panel. This includes API endpoints, filesystem operations, and client UI.

</domain>

<decisions>
## Implementation Decisions

### Context menu design
- Custom styled dropdown menu (Tailwind-styled, matching app theme, with icons and separators)
- Leaf artifacts get the full action menu: Open in Editor, Copy to..., Move to..., separator, Promote to Global / Demote to Project
- Scope nodes get a minimal menu: "Open folder" only (opens .claude/ directory in OS file manager)
- Category nodes: no context menu

### Click behavior
- Single-click on artifact: selects it and shows summary in side panel
- Double-click on artifact: opens in system editor
- Single-click on scope/category: expand/collapse (existing headless-tree behavior)
- Double-click on scope/category: same as single-click (expand/collapse only)

### Promote/demote scope rules
- **Research directive:** Researcher must do a pre-mortem analysis of promote/demote per artifact type. Determine which types are safe to move between scopes and what could break (hooks in settings.json, MCP configs with scope-specific paths, plugins with internal structure, etc.). Decision on which types to allow/block comes from research findings.

### Copy/move destination UX
- Context menu "Copy to..." / "Move to..." expands into a flyout submenu listing all available projects
- For now, simple list. If many projects, a type-to-filter within the submenu can be added (Claude's discretion based on implementation)
- Conflict resolution: confirmation dialog ("X already exists in project Y. Replace it?") with Cancel/Replace buttons
- Success feedback: toast notification at bottom, auto-dismiss after a few seconds

### Clipboard shortcuts
- Cmd+C copies selected artifact to clipboard state, Cmd+V pastes into the currently focused scope/project
- Both clipboard shortcuts and context menu actions supported

### Artifact summary display
- Side panel to the right of the tree, appears only when an artifact is selected
- Panel shows: name, type, scope, path, and description
- Description source: primary is YAML frontmatter `description` field, fallback to first non-frontmatter paragraph if no description exists
- Panel hidden when nothing is selected (tree gets full width)

### Keyboard navigation
- Full keyboard workflow: arrow keys to navigate, Enter to open/select, Esc to close menu
- Cmd+C/V for copy/paste operations
- Shift+F10 or Menu key opens context menu on focused item
- Tab cycles focus zones: toolbar search -> type filter -> tree
- Escape returns focus to tree from anywhere
- Cmd+F jumps directly to search box

### Claude's Discretion
- Context menu component implementation (custom or lightweight library)
- Toast notification library/implementation
- Side panel transition/animation style
- Flyout submenu behavior when project list is long (type-to-filter threshold)
- Server API endpoint design for file operations
- Filesystem operation implementation details (beyond write-file-atomic)
- Focus management edge cases

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project docs
- `.planning/REQUIREMENTS.md` -- OPS-01 through OPS-09, SUMM-01 define all operations requirements
- `.planning/PROJECT.md` -- Constraints (local-only, atomic writes, file-explorer feel, macOS primary)
- `.planning/ROADMAP.md` -- Phase 3 success criteria and requirement mapping

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` -- Artifact classification rules, scanner behavior, atomic writes decision (write-file-atomic)
- `.planning/phases/02-tree-view/02-CONTEXT.md` -- Tree hierarchy (scope > category > leaf), headless-tree setup, icon system, click behavior baseline

### Existing code (key files)
- `src/scanner/types.ts` -- Artifact type with absolutePath, relativePath, scope, frontmatter fields
- `src/server/routes/scan.ts` -- Existing GET /api/scan endpoint (pattern for new operation endpoints)
- `client/src/components/tree/TreeItem.tsx` -- TreeNodeData union type, existing leaf/scope/category rendering
- `client/src/components/tree/ArtifactTree.tsx` -- headless-tree setup, buildItemMaps, event handling baseline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TreeItem.tsx`: TreeNodeData union type with nodeKind discriminant, already renders scope/category/leaf nodes. Needs click/double-click/right-click handlers added.
- `ArtifactTree.tsx`: headless-tree integration with syncDataLoaderFeature. Has expand/collapse, filter, refresh. Needs selection state and keyboard shortcuts added.
- `TreeToolbar.tsx`: Search + type filter toolbar. Needs focus management integration for Tab cycling.
- `iconMap.ts`: TYPE_LABELS and ICON_MAP for all artifact types. Reusable in context menu and side panel.
- `button.tsx`, `input.tsx`, `card.tsx`: shadcn primitives for dialog/toast UI.
- `cn()` utility for Tailwind class merging.
- `write-file-atomic`: Already a project dependency for safe file writes.

### Established Patterns
- Two-build split: tsup for server, Vite for client
- Zod schemas for API request/response validation (server-side)
- Client types as plain TypeScript unions (no Zod on client)
- Fetch-based API calls from client
- React 19 + Tailwind 4 + shadcn primitives

### Integration Points
- New server routes needed under `src/server/routes/` for file operations (copy, move, promote, demote, open)
- Artifact `absolutePath` and `relativePath` fields enable filesystem operations
- Artifact `frontmatter` field already parsed by scanner, available for description extraction
- Artifact `scope` field ('global'/'project') determines promote/demote availability
- Tree container div has `getContainerProps()` from headless-tree for attaching keyboard handlers

</code_context>

<specifics>
## Specific Ideas

- UI should feel like a native file explorer (VS Code sidebar, macOS Finder) per PROJECT.md
- Researcher must do a pre-mortem on promote/demote: which artifact types can safely move between scopes? What breaks for hooks (settings.json entries), MCP configs (scope-specific), plugins (internal structure)?
- Copy/move is the full operation (server-side filesystem), not just UI mockup

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>

---

*Phase: 03-operations*
*Context gathered: 2026-03-29*
