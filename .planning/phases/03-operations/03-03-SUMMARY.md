---
phase: 03-operations
plan: 03
subsystem: ui
tags: [react, context-menu, flyout, conflict-dialog, tailwind, lucide-react, rtl, vitest]

requires:
  - phase: 03-operations-plan-02
    provides: operationsApi.ts with TYPE_DIR_MAP, copyArtifact, moveArtifact, promoteArtifact, demoteArtifact, resolveCopyPath, copyPathToClipboard; Toast.tsx with showToast; ArtifactTree with onContextMenu plumbing; TreeItem with all three nodeKind handlers

provides:
  - ContextMenu component with leaf/scope/category-aware menu items and flyout submenu
  - ConflictDialog component for overwrite confirmation
  - 10 RTL tests for ContextMenu in tests/ContextMenu.test.tsx
  - ArtifactTree wired with contextMenu state and handleContextMenu callback
  - Right-click on any tree node shows appropriate context menu

affects: [03-04-detail-panel, 04-plugin-distribution]

tech-stack:
  added: []
  patterns:
    - "TYPE_DIR_MAP single source of truth: imported from operationsApi, never re-defined in UI components"
    - "Context menu flyout: custom Tailwind dropdown with viewport edge flipping via getBoundingClientRect"
    - "Conflict retry pattern: store retryFn in state, re-call with overwrite=true on user confirm"

key-files:
  created:
    - client/src/components/ContextMenu.tsx
    - client/src/components/ConflictDialog.tsx
    - tests/ContextMenu.test.tsx
  modified:
    - client/src/components/tree/ArtifactTree.tsx

key-decisions:
  - "ConflictDialog managed inside ContextMenu state (not ArtifactTree) to keep conflict retry logic co-located with the operation"
  - "Flyout shows only project scopes (scope.scope === 'project') for copy/move/demote targets, excluding global"
  - "Category node Copy Path resolves rootPath from parent scope via id prefix split (scopeId:type pattern)"

patterns-established:
  - "Conflict handling: retryFn closure stored in state, ConflictDialog calls it with overwrite=true"
  - "Menu close: useEffect with document-level mousedown + keydown listeners; cleanup on unmount"
  - "Flyout activation: onMouseEnter on parent row measures menuRect, computes flyout position with viewport overflow check"

requirements-completed: [OPS-02, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08]

duration: 3min
completed: 2026-03-28
---

# Phase 3 Plan 03: Context Menu and Operation Wiring Summary

**Right-click context menu with flyout project selector, conflict dialog, and full copy/move/promote/demote wiring for all three tree node types**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T21:55:45Z
- **Completed:** 2026-03-28T21:58:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- ContextMenu renders node-appropriate items: leaf gets full menu (Open, Copy Path, Copy to, Move to, Promote/Demote), scope gets Open Folder + Copy Path, category gets Copy Path only
- Flyout submenu for Copy to/Move to/Demote with project list, type-to-filter input when >8 projects, and viewport overflow handling
- Conflict dialog wired end-to-end: conflict response opens dialog, Replace File re-calls API with overwrite=true, onRefresh() called on success
- Toast messages include session restart notice for move/promote/demote operations
- 10 RTL tests covering all menu variants, disabled states, Esc close, and conflict dialog trigger

## Task Commits

1. **Task 1: Create ContextMenu, ConflictDialog, and test scaffold** - `69e65d4` (feat)
2. **Task 2: Wire context menu into ArtifactTree** - `606d41f` (feat)

## Files Created/Modified

- `client/src/components/ContextMenu.tsx` - Context menu with flyout submenu, viewport edge flipping, conflict handling, and toast feedback
- `client/src/components/ConflictDialog.tsx` - Modal conflict dialog with Keep Original / Replace File buttons
- `tests/ContextMenu.test.tsx` - 10 RTL tests covering leaf/scope/category menus, blocked types, keyboard close, operations
- `client/src/components/tree/ArtifactTree.tsx` - Added contextMenu state, handleContextMenu callback, ContextMenu render, ContextMenu import

## Decisions Made

- ConflictDialog managed inside ContextMenu (not ArtifactTree) — conflict retry logic stays co-located with the operation that triggered it
- Category Copy Path resolves rootPath from the parent scope by splitting the category id on `:` (format is `scopeId:type`)
- Flyout only lists project-scoped scopes (not global) as copy/move/demote targets, matching the operations matrix

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TreeItem already had `onContextMenu` handlers on all three node types from Plan 02.

## Next Phase Readiness

- Context menu fully operational for all node types
- Operations complete with toast feedback, conflict handling, and tree refresh
- Plan 04 (ArtifactDetailPanel) can proceed independently — no dependencies on this plan
- The `server.test.ts` port conflict failure (`EADDRINUSE` on port 3737) is pre-existing and unrelated to this plan

---
*Phase: 03-operations*
*Completed: 2026-03-28*
