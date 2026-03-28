---
phase: 02-tree-view
plan: 03
subsystem: ui, scanner
tags: [react, headless-tree, scanner, mcp, plugins]

# Dependency graph
requires:
  - phase: 02-tree-view plan 02
    provides: ArtifactTree component, TreeToolbar, TreeSkeleton, TreeItem, iconMap

provides:
  - App.tsx fully wired to ArtifactTree with scan state, query, typeFilter, error handling
  - 6 passing component tests covering TREE-01, TREE-03, TREE-04, TREE-06, loading, error states
  - Scanner overhaul: whitelist scanning, dedup, MCP scopes, plugin status, project discovery
  - Verified tree view in browser (human visual checkpoint passed)

affects: [03-artifact-actions, 04-plugin-distribution]

# Tech tracking
tech-stack:
  added: ["@testing-library/react", "@testing-library/jest-dom"]
  patterns:
    - "@vitest-environment happy-dom docblock for component tests"
    - "headless-tree requires explicit rebuildTree() call when data changes after mount"
    - "Artifact IDs must include projectId to prevent cross-scope collision"

key-files:
  created:
    - .planning/BACKLOG.md
  modified:
    - client/src/App.tsx
    - client/src/components/tree/ArtifactTree.tsx
    - client/src/components/tree/TreeItem.tsx
    - client/src/components/tree/TreeToolbar.tsx
    - client/src/components/tree/iconMap.ts
    - client/src/lib/deriveVisibleTree.ts
    - client/src/lib/types.ts
    - src/scanner/classify.ts
    - src/scanner/discover.ts
    - src/scanner/index.ts
    - src/scanner/types.ts
    - vite.config.ts

key-decisions:
  - "Whitelist artifact dirs (commands, agents, skills, memory, plans, hooks, references) instead of walking all files"
  - "Drop unknown type entirely — if scanner can't classify it, don't show it"
  - "MCP servers tagged with mcpScope (project/local/user) from 3 sources: .mcp.json, ~/.claude.json global, ~/.claude.json per-project"
  - "Plugin enabled/disabled from settings.json enabledPlugins field"
  - "GSD system commands filtered from project scopes (they're copies, not project-specific)"
  - "Section-based sorting: global > current project > alphabetical other projects"
  - "Expand/collapse all as text toggle above tree, not toolbar buttons"

requirements-completed: [TREE-01, TREE-02, TREE-03, TREE-04, TREE-05, TREE-06, TREE-07, TREE-08]

# Metrics
duration: ~3hrs (includes extensive visual checkpoint review)
completed: 2026-03-29
---

# Phase 02 Plan 03: App Integration, Visual Verification, Scanner Overhaul

## Summary

Wired ArtifactTree into App.tsx and completed component tests. Visual checkpoint with user revealed major scanner data quality issues (not tree UI bugs) which were fixed inline: 12k unknowns eliminated, deduplication added, MCP scope tagging, plugin status, and project discovery from ~/.claude/projects/.

## Accomplishments

### App Integration (pre-checkpoint)
- Replaced placeholder Card with ArtifactTree in App.tsx
- Completed 6 component tests from RED-phase stubs
- Fixed headless-tree API (getId vs getItemId)

### Scanner Overhaul (during checkpoint)
- Whitelist-based scanning: 12,146 -> 128 global artifacts (eliminated unknowns)
- Deduplication by name+type (skills were 3x duplicated across marketplace copies)
- MCP extraction from .mcp.json + ~/.claude.json with scope tagging (project/local/user)
- Hook extraction with correct event-keyed settings.json format
- Memory discovery from ~/.claude/projects/{encoded}/memory/
- Plugin naming from plugin.json content, enabled/disabled from settings.json
- Project discovery from ~/.claude/projects/ with ambiguous path resolution (spaces, dashes)
- GSD system commands filtered from project scopes
- Empty scopes filtered from results

### UI Polish (during checkpoint)
- rebuildTree on data change (headless-tree only rebuilds on mount)
- Cross-scope ID collision fix (include projectId in hash)
- Header/toolbar overlap fixed
- Scope badges removed from parent nodes
- MCP scope pills with color coding (blue/amber/purple)
- Plugin enabled/disabled pills (green/grey)
- Section headers (Current Project / Other Projects) with alphabetical sort
- Expand all / Collapse all text toggle
- Auto-expand on filter, collapse on clear
- Type filter crash fix
- deriveVisibleTree fix for plugins with empty children[]

## Commits

1. `eb01a0e` — feat(02-03): wire ArtifactTree into App.tsx, complete component tests
2. `08949ce` — docs(02-03): checkpoint reached
3. `1dda19c` — fix(02-03): tree rendering fixes
4. `8538783` — fix(02-03): scanner overhaul
5. `53293d0` — docs(02-03): add BACKLOG.md

## Self-Check: PASSED

---
*Phase: 02-tree-view*
*Completed: 2026-03-29*
