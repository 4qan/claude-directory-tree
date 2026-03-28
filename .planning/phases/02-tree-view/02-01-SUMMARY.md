---
phase: 02-tree-view
plan: 01
subsystem: ui
tags: [react, typescript, lucide-react, headless-tree, vitest, happy-dom]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: scanner types (ArtifactType, Artifact, ScopeNode, ScanResponse)
provides:
  - Client-side type definitions mirroring scanner types (no Zod dependency)
  - deriveVisibleTree pure filter function for tree data
  - ArtifactType to Lucide icon mapping (ICON_MAP, TYPE_LABELS)
  - Vitest configured for both node and happy-dom environments
  - @headless-tree/react and @headless-tree/core installed
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: ["@headless-tree/react", "@headless-tree/core", "happy-dom"]
  patterns:
    - "Client types are plain TypeScript (no Zod) — server validates, client trusts"
    - "TDD: write failing tests first, then implement to pass"
    - "vitest environmentMatchGlobs for per-file environment selection"

key-files:
  created:
    - client/src/lib/types.ts
    - client/src/lib/deriveVisibleTree.ts
    - client/src/components/tree/iconMap.ts
    - tests/iconMap.test.ts
    - tests/deriveVisibleTree.test.ts
  modified:
    - vitest.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "lucide-react v1 exports icons as React.forwardRef objects (typeof === 'object'), not plain functions — iconMap tests check for $$typeof instead of typeof === 'function'"
  - "Client types use plain TypeScript union types (not Zod) — no Zod in client code"
  - "vitest @ alias resolves to client/src for consistent import paths in tests"

patterns-established:
  - "Pattern 1: All client imports use @ alias pointing to client/src"
  - "Pattern 2: deriveVisibleTree is a pure function — no side effects, suitable for memoization"
  - "Pattern 3: Plugin containers (artifacts with children) are kept if any child survives filtering"

requirements-completed: [TREE-01, TREE-02, TREE-05, TREE-07, TREE-08]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 02 Plan 01: Foundation — Types, Filtering, and Icon Map Summary

**Client-side type system, deriveVisibleTree filter pipeline, and Lucide icon map — 15 unit tests passing across two test files with happy-dom configured for component tests.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-28T22:20:00Z
- **Completed:** 2026-03-28T22:35:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Installed @headless-tree/react, @headless-tree/core, and happy-dom; configured vitest with @ alias and environmentMatchGlobs
- Created client/src/lib/types.ts with plain TS types (no Zod) mirroring server scanner types
- Created iconMap.ts mapping all 10 ArtifactType values to Lucide icons and human-readable labels
- Implemented deriveVisibleTree pure filter function with name/type AND-logic, empty scope pruning, and plugin child preservation
- 15 unit tests passing across iconMap (6 tests) and deriveVisibleTree (9 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, client types, iconMap, and unit tests** - `8c14210` (feat)
2. **Task 2: Build deriveVisibleTree filtering function with 9 unit tests** - `c470df6` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `client/src/lib/types.ts` - ArtifactType union, ARTIFACT_TYPES array, Artifact/ScopeNode/ScanResponse types
- `client/src/lib/deriveVisibleTree.ts` - Pure filter function with filterArtifacts and countAll helpers
- `client/src/components/tree/iconMap.ts` - ICON_MAP (ArtifactType -> LucideIcon) and TYPE_LABELS records
- `tests/iconMap.test.ts` - 6 tests: key count, valid React components, label values
- `tests/deriveVisibleTree.test.ts` - 9 tests: passthrough, name/type/AND filters, empty scope removal, plugin nesting, artifactCount, case insensitivity
- `vitest.config.ts` - Added @ alias and environmentMatchGlobs for happy-dom on .tsx tests
- `package.json` / `package-lock.json` - Added @headless-tree/react, @headless-tree/core, happy-dom

## Decisions Made

- lucide-react v1 exports icons as `React.forwardRef` objects (typeof === 'object'), not plain functions. The iconMap test checks for `$$typeof` presence rather than `typeof === 'function'` to correctly identify valid React components.
- Client types use plain TypeScript union types (no Zod) — validation is the server's responsibility, client trusts the API response.
- The vitest `@` alias resolves to `client/src`, matching the Vite build alias, so test imports are identical to production imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted iconMap test to handle lucide-react v1 forwardRef export format**
- **Found during:** Task 1 (iconMap tests)
- **Issue:** Plan behavior spec said "every value in ICON_MAP is a function" but lucide-react v1 exports icons as forwardRef objects (typeof === 'object'), causing the test to fail
- **Fix:** Updated test to check for `$$typeof` presence (valid React component check) rather than `typeof === 'function'`
- **Files modified:** tests/iconMap.test.ts
- **Verification:** All 6 iconMap tests pass
- **Committed in:** 8c14210 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test expectation vs actual library behavior)
**Impact on plan:** Minimal — test assertion updated to match actual lucide-react API. iconMap implementation unchanged.

## Issues Encountered

- Pre-existing `server.test.ts` failure (EADDRINUSE port 3737) unrelated to this plan's changes. Not caused by, and not fixed by, this plan.

## Next Phase Readiness

- All types exportable via `@/lib/types` alias
- `deriveVisibleTree` ready for use in TreeView component (02-02)
- `ICON_MAP` and `TYPE_LABELS` ready for use in TreeItem component (02-02)
- happy-dom configured — component tests in 02-02 can use .tsx test files
- Blocker confirmed: headless-tree React 19 compatibility works (packages install and import correctly)

---
*Phase: 02-tree-view*
*Completed: 2026-03-28*
