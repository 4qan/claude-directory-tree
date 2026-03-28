---
phase: 03-operations
plan: 02
subsystem: client-ui
tags: [selection, detail-panel, toast, operations-api, click-handlers]
dependency_graph:
  requires: [03-01]
  provides: [operationsApi, ArtifactDetailPanel, Toast, selection-wiring]
  affects: [03-03]
tech_stack:
  added: ["@testing-library/user-event"]
  patterns: [module-level-subscribers, derived-state, headless-tree-selection]
key_files:
  created:
    - client/src/lib/operationsApi.ts
    - client/src/components/Toast.tsx
    - client/src/components/ArtifactDetailPanel.tsx
    - tests/ArtifactDetailPanel.test.tsx
  modified:
    - client/src/components/tree/TreeItem.tsx
    - client/src/components/tree/ArtifactTree.tsx
    - client/src/App.tsx
decisions:
  - "TYPE_DIR_MAP exported from operationsApi.ts as single client-side source of truth (Plan 03 imports, not redefines)"
  - "showToast uses module-level subscriber set, no React context needed -- importable from anywhere"
  - "Selection lifted to App.tsx via onSelectedArtifactChange callback; ArtifactTree owns selectedIds state internally"
  - "Esc key handler placed on ArtifactTree container div to clear selection"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-28T21:53:39Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 03 Plan 02: Selection, Detail Panel, Toast, and Client API Summary

Client API layer, toast notification system, artifact detail panel, and tree interaction wiring. Provides the foundation Plan 03 (context menu) consumes.

## Tasks Completed

### Task 1: Create client operations API layer, Toast component, ArtifactDetailPanel, and test scaffold

**Commit:** d81eea5

Created four files:

- `client/src/lib/operationsApi.ts`: fetch wrappers for all /api/operations/* endpoints. `TYPE_DIR_MAP` exported as the single client-side source of truth for type-to-directory mapping. `resolveCopyPath` handles all node kinds (leaf with virtual/directory-type variants, scope, category). `copyPathToClipboard` wraps clipboard API.

- `client/src/components/Toast.tsx`: `showToast(message, type, duration)` is a module-level function using a subscriber set. `ToastContainer` renders at bottom-center, fixed position. No React context required -- importable from any component. Error toasts get 6s duration (caller-controlled).

- `client/src/components/ArtifactDetailPanel.tsx`: 280px fixed-width panel. Shows name (text-base font-semibold), type with icon, scope label, absolutePath (font-mono), and description. Fast path uses frontmatter.description; fallback calls `describeArtifact`. Virtual artifacts (containing `#`) strip the fragment before the describe call.

- `tests/ArtifactDetailPanel.test.tsx`: 6 RTL tests covering null artifact, name/type/path rendering, frontmatter description, server fallback, close button, and null description fallback.

**Deviation:** `@testing-library/user-event` was not installed -- installed it (Rule 3 blocking fix). All 6 tests pass.

### Task 2: Wire selection state, click handlers, Copy Path, and detail panel into tree

**Commit:** c2190b0

- `TreeItem.tsx`: Added `isSelected`, `onSelect`, `onDoubleClick`, `onContextMenu` props. Leaf nodes get all three event handlers plus `bg-primary/10` selected styling and focus-visible ring. Scope and category nodes get `onContextMenu` for Copy Path support in Plan 03.

- `ArtifactTree.tsx`: Added `selectionFeature` and `hotkeysCoreFeature` from `@headless-tree/core`. `selectedIds` and `focusedId` state wired into `useTree` config. `selectedArtifact` derived via `useMemo` from `selectedIds + items`. `onSelectedArtifactChange` prop notifies parent via `useEffect`. Esc key handler on container div clears selection. `openInEditor` called on double-click.

- `App.tsx`: `selectedArtifact` state in App. Layout changed to flex row (`main` with tree column + panel). `ArtifactDetailPanel` rendered conditionally based on `selectedArtifact`. `ToastContainer` mounted at root level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @testing-library/user-event dependency**
- **Found during:** Task 1 test run
- **Issue:** `@testing-library/user-event` not in package.json but required for click simulation in tests
- **Fix:** `npm install --save-dev @testing-library/user-event`
- **Files modified:** package.json, package-lock.json
- **Commit:** d81eea5

## Verification Results

- `npx vitest run tests/ArtifactDetailPanel.test.tsx`: 6/6 tests pass
- `npx vitest run tests/ArtifactTree.test.tsx`: 6/6 tests pass (existing tests unaffected)
- `npx tsc --noEmit --project client/tsconfig.json`: New files type-clean (pre-existing TreeToolbar.tsx implicit-any errors unrelated to this plan; @/ alias resolution is Vite-only, not tsconfig-declared)
- Full suite: 86/87 tests pass -- 1 failure in server.test.ts is pre-existing EADDRINUSE port conflict, unrelated to this plan

## Self-Check: PASSED

All 7 key files exist on disk. Both task commits (d81eea5, c2190b0) verified in git log.
