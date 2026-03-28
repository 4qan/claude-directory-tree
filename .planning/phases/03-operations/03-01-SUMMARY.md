---
phase: 03-operations
plan: 01
subsystem: api
tags: [fastify, zod, node-fs, gray-matter, open, operations, file-ops]

requires:
  - phase: 01-foundation
    provides: Fastify server setup, createServer/startServer pattern, Zod validation
  - phase: 02-tree-view
    provides: ArtifactType definitions in scanner/types.ts

provides:
  - "Shared type contracts in src/shared/operationTypes.ts"
  - "6 POST operation endpoints under /api/operations/*"
  - "Pre-flight @-reference scanning with warnings"
  - "Operations matrix enforcement (BLOCKED returns 400, WARNING adds typed warnings)"
  - "Conflict detection returning conflict:true"
  - "fs.cp+fs.rm move semantics (EXDEV-safe)"

affects:
  - 03-02-ui-context-menu
  - 03-03-ui-selection
  - 03-04-ui-detail-panel

tech-stack:
  added: []
  patterns:
    - "ARTIFACT_TYPE_DIR_MAP: type string -> filesystem subdirectory mapping"
    - "BLOCKED_TYPES/WARNING_MESSAGES constants drive operations matrix enforcement"
    - "performCopy() shared core: conflict check -> preflight scan -> execute"
    - "400 response schema declared alongside 200 for blocked-type routes"
    - "fs.cp + fs.rm (never fs.rename) for all move/promote/demote operations"

key-files:
  created:
    - src/shared/operationTypes.ts
    - src/server/routes/operations.ts
    - tests/operations.test.ts
  modified:
    - src/server/index.ts

key-decisions:
  - "400 response declared in Zod schema (response: { 200: ..., 400: ... }) to satisfy TypeScript strict type checking on reply.code(400)"
  - "scanReferences() checks for /^@\\// pattern (line starts with @/) to find absolute includes, not relative"
  - "performCopy() extracted as shared helper used by copy, move, promote, demote to avoid duplication"
  - "DIRECTORY_TYPES uses path.dirname(sourcePath) as copy source so entire skill/plugin dir is transferred"

patterns-established:
  - "Pattern: response schema must declare all HTTP codes used (200 and 400)"
  - "Pattern: preflight warnings returned inside success response body, not as HTTP errors"

requirements-completed: [OPS-01, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09]

duration: 25min
completed: 2026-03-29
---

# Phase 03 Plan 01: Operations API Summary

**Fastify operations API with 6 endpoints, operations matrix enforcement (hook/mcp-config blocked), pre-flight @-reference scanning, and EXDEV-safe move using fs.cp+fs.rm**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-29T02:44:00Z
- **Completed:** 2026-03-29T02:50:00Z
- **Tasks:** 3 (Task 1, Task 2a TDD-RED, Task 2b TDD-GREEN)
- **Files modified:** 4

## Accomplishments

- `src/shared/operationTypes.ts` establishes the full type contract: ARTIFACT_TYPE_DIR_MAP, BLOCKED_TYPES, WARNING_MESSAGES, DIRECTORY_TYPES, and all Zod schemas for request/response
- 6 POST endpoints implemented under `/api/operations/*` (open, copy, move, promote, demote, describe) with shared `performCopy()` core
- Pre-flight `scanReferences()` detects absolute `@/`-includes in .md files and surfaces them as `type: 'reference'` warnings
- All 18 tests pass including fs.rename spy test confirming EXDEV-safe move implementation

## Task Commits

1. **Task 1: Create shared operation type contracts** - `fa615e8` (feat)
2. **Task 2a: Create operation route test suite** - `8b33050` (test)
3. **Task 2b: Implement server operation routes** - `1e8a647` (feat)

## Files Created/Modified

- `src/shared/operationTypes.ts` - Shared Zod schemas and operation constants (ARTIFACT_TYPE_DIR_MAP, BLOCKED_TYPES, WARNING_MESSAGES, DIRECTORY_TYPES)
- `src/server/routes/operations.ts` - 6 POST endpoints with operationsRoutes export
- `tests/operations.test.ts` - 18 test cases covering all endpoints including EXDEV spy
- `src/server/index.ts` - Added operationsRoutes import and registration

## Decisions Made

- **400 schema declaration:** TypeScript requires declaring `400: OperationResultSchema` alongside `200` in the response schema when calling `reply.code(400).send(...)`. This was found during type-check after implementation.
- **performCopy() shared helper:** Copy, move, promote, and demote share the same conflict-check and preflight-scan logic. Extracted to avoid duplication across 4 routes.
- **scanReferences uses `^@\//` pattern:** Matches lines starting with `@/` (absolute @-include paths) specifically, not relative includes or other `@` usage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 400 response schema to routes that return 400**
- **Found during:** Task 2b verification (npx tsc --noEmit)
- **Issue:** Fastify ZodTypeProvider type system requires all response codes used in the handler to be declared in the schema. Routes using `reply.code(400)` without declaring `400: OperationResultSchema` caused TypeScript errors.
- **Fix:** Added `400: OperationResultSchema` to response schema for copy, move, promote, and demote routes.
- **Files modified:** src/server/routes/operations.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 1e8a647 (Task 2b commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Minor fix necessary for type correctness. No behavior change.

## Issues Encountered

- Pre-existing `tests/server.test.ts` `INFRA-03` test fails intermittently with EADDRINUSE when port 3737 is occupied during parallel test runs. Confirmed pre-existing by running the test suite before Task 2b changes. Not caused by this plan.

## Next Phase Readiness

- All 6 operation endpoints available for client UI to call
- Type contracts in `src/shared/operationTypes.ts` ready for import by client code (Plans 02-04)
- No blockers for Phase 03 Plans 02-04

---
*Phase: 03-operations*
*Completed: 2026-03-29*
