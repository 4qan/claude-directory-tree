---
phase: 01-foundation
plan: 02
subsystem: scanner
tags: [gray-matter, write-file-atomic, vitest, artifact-classification, plugin-expansion]

requires:
  - phase: 01-01
    provides: Type contracts (ArtifactSchema, ScanResponseSchema) and test fixtures

provides:
  - findClaudeDirs: recursive .claude/ directory discovery with noise-dir skipping
  - classifyFile: file-level artifact classification via path + frontmatter
  - classifyScope: full scope artifact list with hooks extraction and plugin expansion
  - runScan: orchestrator producing ScanResponse combining discovery + registration + classification
  - getRegisteredProjects/addProject/removeProject: persistent project registration with atomic writes

affects: [02-api, 03-file-ops]

tech-stack:
  added: [gray-matter (frontmatter parsing), write-file-atomic (atomic JSON writes)]
  patterns:
    - TDD red-green cycle with vitest
    - Plugin children attached to parent artifact and removed from top-level list
    - configFile optional param for testability without touching real filesystem
    - Plugin name derived from parent directory, not filename

key-files:
  created:
    - src/scanner/discover.ts
    - src/scanner/classify.ts
    - src/scanner/index.ts
    - src/config/projects.ts
    - tests/scanner.test.ts
    - tests/classify.test.ts
    - tests/config.test.ts
  modified: []

key-decisions:
  - "Plugin artifact name comes from parent directory name (test-plugin), not filename (plugin)"
  - "classifyScope deduplicates plugin children from top-level using absolutePath Set"
  - "configFile optional parameter on all config functions enables test isolation without real ~/.claude-directory-tree"

patterns-established:
  - "classifyByPath: path segment matching before frontmatter override"
  - "TDD: test commit first, then implementation commit"

requirements-completed: [SCAN-01, SCAN-02, SCAN-03, SCAN-04]

duration: 15min
completed: 2026-03-28
---

# Phase 01 Plan 02: Scanner Implementation Summary

**Recursive artifact scanner with path+frontmatter classification, settings.json hook extraction, plugin expansion, and atomic project registration**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-28T20:27:00Z
- **Completed:** 2026-03-28T20:32:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Full recursive .claude/ discovery skipping 11 noise directories (node_modules, .git, dist, etc.)
- 9 artifact type classification (command, agent, skill, hook, claude-md, mcp-config, memory, plan, plugin) via path matching with frontmatter override
- Plugin expansion: greet command nested as child of test-plugin, not duplicated at top level
- Hooks extracted from settings.json as typed artifacts
- Atomic project registration at ~/.claude-directory-tree/projects.json with dedup
- 38 tests passing across 4 test files (cli.test.ts skipped -- requires build)

## Task Commits

1. **RED - Task 1 tests** - `f001ff5` (test)
2. **GREEN - Task 1 + Task 2 impl** - `5525a31` (feat)
3. **RED+GREEN - Task 2 tests** - `02654ed` (test, implementation already in place)

## Files Created/Modified

- `src/scanner/discover.ts` - findClaudeDirs with SKIP_DIRS set and no recursion into .claude
- `src/scanner/classify.ts` - classifyFile, classifyScope, expandPlugin with gray-matter
- `src/scanner/index.ts` - runScan orchestrator: discovery + registration + dedup + scope build
- `src/config/projects.ts` - getRegisteredProjects/addProject/removeProject with write-file-atomic
- `tests/scanner.test.ts` - findClaudeDirs, runScan, performance test
- `tests/classify.test.ts` - All 9 artifact types, hooks, plugin expansion, scope
- `tests/config.test.ts` - 7 cases: empty state, add, dedup, multi-add, remove, no-op

## Decisions Made

- Plugin artifact `name` is derived from the parent directory name (e.g., `test-plugin`), not the filename (`plugin`). This makes plugin names human-readable in the tree view.
- Plugin child deduplication uses an `absolutePath` Set built before top-level filtering. Clean O(n) approach.
- `configFile` optional param pattern used for all config functions -- no mocking needed in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plugin name used directory name instead of basename-without-extension**
- **Found during:** Task 1 (plugin expansion test failed: expected name 'test-plugin', got 'plugin')
- **Issue:** `classifyFile` computed name as `path.basename(filePath)` minus extension, giving `plugin` for `plugin.json`
- **Fix:** Added special case in `classifyFile`: when basename is `plugin.json`, use `path.basename(path.dirname(filePath))` as name
- **Files modified:** src/scanner/classify.ts
- **Verification:** `classifyScope` test for `a.name === 'test-plugin'` passes
- **Committed in:** 5525a31 (Task 1 implementation commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for correct plugin naming. No scope creep.

## Issues Encountered

None beyond the plugin name deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scanner is the data engine. All downstream phases (API, file ops) can now import `runScan`.
- `ScanResponseSchema` validates correctly with Zod v4 recursive schema (established in Plan 01).
- No blockers.

---
*Phase: 01-foundation*
*Completed: 2026-03-28*
