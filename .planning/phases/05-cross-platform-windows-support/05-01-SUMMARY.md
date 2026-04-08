---
phase: 05-cross-platform-windows-support
plan: 01
subsystem: scanner
tags: [cross-platform, windows, path-decoding, tdd]
dependency_graph:
  requires: []
  provides: [decodeProjectCacheName, cross-platform-scanner]
  affects: [src/scanner/index.ts, src/scanner/classify.ts]
tech_stack:
  added: []
  patterns: [os.platform() branching, path.parse().root, path.sep, path.join]
key_files:
  created: []
  modified:
    - src/scanner/index.ts
    - src/scanner/classify.ts
    - tests/scanner.test.ts
    - tests/classify.test.ts
decisions:
  - "decodeProjectCacheName handles both C-Users (single-hyphen) and C--Users (double-hyphen) Windows encoding variants"
  - "path.parse(naivePath).root used for resolveProjectPath root; fallback to '/' for safety"
  - "classify.ts encoding regex now covers forward slash, backslash, and colon"
metrics:
  duration_seconds: 111
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 4
requirements:
  - XPLAT-01
  - XPLAT-02
  - XPLAT-03
---

# Phase 05 Plan 01: Cross-Platform Path Decoding and Encoding Summary

**One-liner:** Extracted `decodeProjectCacheName` with `os.platform()` Windows branching and fixed three Unix-hardcoded path assumptions in the scanner and one in the classifier.

## What Was Built

Cross-platform path handling for the Claude Code project cache scanner. The scanner was hardcoded for Unix in four places; all four are now fixed using Node.js built-in path APIs and OS detection.

## Tasks Completed

| Task | Description | Commit | Type |
|------|-------------|--------|------|
| 1 | Write failing tests (RED phase) | e31063e | test |
| 2 | Implement cross-platform fixes (GREEN phase) | 29ec63e | feat |

## Changes Made

### src/scanner/index.ts

- Added `import os from 'node:os'`
- Exported `decodeProjectCacheName(encodedName: string): string` — branches on `os.platform() === 'win32'` to reconstruct `C:\Users\bob\proj` from either `C-Users-bob-proj` or `C--Users-bob-proj`
- Fixed `resolveProjectPath`: replaced `let current = '/'` with `path.parse(naivePath).root || '/'`
- Fixed segment split: `naivePath.split(path.sep)` instead of `split('/')`
- Replaced inline naive decode with `decodeProjectCacheName(entry.name)` call
- Fixed parent construction: `path.join(naiveDecodedRoot, ...segments.slice(0, depth))` instead of `'/' + segments.join('/')`

### src/scanner/classify.ts

- Fixed memory cache path encoding: `replace(/[\/\\ :]/g, '-')` instead of `replace(/[/ ]/g, '-')` — now handles Windows backslashes and colons

### tests/scanner.test.ts

- Added `describe('decodeProjectCacheName')` with 4 tests covering Unix decode, Windows single-hyphen, Windows double-hyphen, and default platform
- Uses `vi.spyOn(os, 'platform').mockReturnValue('win32')` to test Windows branch on macOS/Linux CI

### tests/classify.test.ts

- Added `describe('encodeProjectRoot - cross-platform')` with 2 tests (XPLAT-03) covering Unix and Windows encoding regex

## Test Results

- 39/39 tests pass in scanner.test.ts and classify.test.ts
- Pre-existing ContextMenu.test.tsx failure unchanged (not related to this plan)
- No regressions introduced

## Deviations from Plan

None. Plan executed exactly as written.

## Decisions Made

1. `decodeProjectCacheName` handles both `C-Users` (single-hyphen) and `C--Users` (double-hyphen) Windows variants as the research flagged ambiguity in Claude Code's encoding behavior.
2. `path.parse(naivePath).root || '/'` used as a safe fallback for the root on all platforms.
3. The XPLAT-03 test in classify.test.ts tests the regex directly on string literals rather than calling a helper, matching the plan's inline test approach.

## Self-Check

See below.
