---
phase: 03-operations
plan: 04
subsystem: ui-keyboard
tags: [keyboard, clipboard, focus, uat]

requires:
  - phase: 03-operations
    plan: 03
    provides: Context menu, selection state, all operation wiring

provides:
  - "Keyboard shortcuts: Cmd+C/V clipboard, Shift+F10 context menu, Cmd+F search focus"
  - "Tab cycling: search → type filter → tree"
  - "Esc: close context menu first, then clear selection"
  - "UAT-driven fixes: context menu backgrounds, preview pane layout, preflight warnings"
  - "Viewport-locked layout with independent scroll for tree and detail panel"

key-files:
  modified:
    - client/src/components/tree/ArtifactTree.tsx
    - client/src/components/tree/TreeToolbar.tsx
    - client/src/components/tree/TreeItem.tsx
    - client/src/components/ArtifactDetailPanel.tsx
    - client/src/components/ContextMenu.tsx
    - client/src/components/Toast.tsx
    - client/src/App.tsx
    - client/src/App.css
    - client/src/lib/deriveVisibleTree.ts
    - client/src/lib/operationsApi.ts
    - client/src/components/tree/iconMap.ts
    - src/server/routes/operations.ts
    - src/shared/operationTypes.ts

deviations:
  - "Extensive UAT-driven UI fixes beyond original plan scope: context menu styling, preview pane redesign, preflight warning dialog, MCP descriptions, demote path bug, plugin filter fix, transfer operation blocking for non-transferable types"

self-check: PASSED
---

## What was built

### Task 1: Keyboard shortcuts and focus management
- Cmd+C copies selected leaf to clipboard state (tree-scoped, doesn't interfere with native copy)
- Cmd+V pastes clipboard artifact into focused scope's project via copyArtifact
- Shift+F10 opens context menu on focused tree item
- Cmd+F focuses search input from anywhere
- Esc closes context menu first, clears selection second
- Tab cycles: search → type filter → tree container

### Task 2: Human verification (UAT)
Comprehensive UAT with 11 test scenarios across 3 purpose-built test projects:
- Baseline verification (3 projects)
- Copy without conflict, with conflict (Keep + Replace), with reference warning
- Move with reference warning
- Skill copy (directory-based), with conflict
- Promote to Global, Demote from Global (fixed double .claude path bug)
- Plugin filter fix

### UAT-driven fixes
- Tailwind v4 @theme inline block for custom color utilities
- Context menu: opaque background, hover highlights, flyout close delay, viewport clamping
- Preview pane: 360px width, viewport-locked layout, independent scroll
- Preflight API endpoint + warning confirmation dialog
- MCP server descriptions (command/url instead of raw JSON)
- Selection highlighting for all node types
- Singular type labels in toasts, 5s default duration
- Blocked transfer operations for plugins, plans, memory, claude-md
