---
phase: quick
plan: 260330-qpc
subsystem: scanner
tags: [bug-fix, plugin, tdd]
dependency_graph:
  requires: []
  provides: [cached-plugin-visibility]
  affects: [classifyScope, expandPlugin]
tech_stack:
  added: []
  patterns: [detect-and-redirect layout detection via path.basename check]
key_files:
  created:
    - tests/fixtures/.claude/plugins/cached-plugin/.claude-plugin/plugin.json
    - tests/fixtures/.claude/plugins/cached-plugin/agents/reviewer.md
    - tests/fixtures/.claude/plugins/cached-plugin/commands/deploy.md
  modified:
    - src/scanner/classify.ts
    - tests/classify.test.ts
decisions:
  - pluginDir resolution checks path.basename for .claude-plugin and redirects to parent; no changes to expandPlugin signature needed
metrics:
  duration: "~2 minutes"
  completed: "2026-03-30"
  tasks_completed: 1
  files_changed: 5
---

# Quick Task 260330-qpc: Plugin Internal Visibility Scanner Fix Summary

**One-liner:** Fixed pluginDir resolution in classifyScope to handle `.claude-plugin/` nested layout by redirecting scan root to the version directory parent.

## What Was Done

Cached plugins install with the layout `version-dir/.claude-plugin/plugin.json` where artifacts live as siblings of `.claude-plugin/` (in `version-dir/agents/`, `version-dir/commands/`, etc.). The scanner was calling `path.dirname(artifact.absolutePath)` to get the plugin root, which returned `.claude-plugin/` instead of `version-dir/`. This caused `expandPlugin` to scan an empty directory with no recognized artifacts.

## Changes

### src/scanner/classify.ts

Added a 3-line layout detection before calling `expandPlugin`:

```typescript
const pluginJsonDir = path.dirname(artifact.absolutePath);
// Cached plugins: plugin.json lives in .claude-plugin/ subdir; artifacts are in the parent
const pluginDir = path.basename(pluginJsonDir) === '.claude-plugin'
  ? path.dirname(pluginJsonDir)
  : pluginJsonDir;
```

### tests/classify.test.ts

Added 3 new tests:
- "cached plugin with .claude-plugin/ layout has children populated" (expects length 2)
- "cached plugin children include reviewer agent and deploy command"
- "cached plugin children not duplicated at top level"

### Test Fixtures

Created `tests/fixtures/.claude/plugins/cached-plugin/` with:
- `.claude-plugin/plugin.json` (name: cached-plugin)
- `agents/reviewer.md` (frontmatter name: reviewer)
- `commands/deploy.md` (frontmatter name: deploy)

## Test Results

- 23/23 tests pass in `tests/classify.test.ts`
- Pre-existing failures in `tests/ContextMenu.test.tsx` and `tests/server.test.ts` are unrelated (verified by running them before this change)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `tests/fixtures/.claude/plugins/cached-plugin/.claude-plugin/plugin.json` exists
- [x] `tests/fixtures/.claude/plugins/cached-plugin/agents/reviewer.md` exists
- [x] `tests/fixtures/.claude/plugins/cached-plugin/commands/deploy.md` exists
- [x] Commit `2825c4b` exists

## Self-Check: PASSED
