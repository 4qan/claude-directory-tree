---
phase: 04-plugin-distribution
plan: 01
subsystem: infra
tags: [claude-plugin, npm, packaging, distribution, marketplace]

# Dependency graph
requires:
  - phase: 03-operations
    provides: completed application logic (CLI, server, scanner, operations)
provides:
  - Claude Code plugin structure (plugin.json, commands/launch.md, commands/add.md)
  - Marketplace catalog (.claude-plugin/marketplace.json)
  - npm package configured for publish (files allowlist, prepublishOnly, repository metadata)
  - MIT LICENSE file
affects: [04-plugin-distribution plan 02 (README + publish), users installing via /plugin install]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin name claude-tree with command files launch.md/add.md produces /claude-tree:launch and /claude-tree:add"
    - "Plugin commands are markdown prompts that tell Claude to run npx claude-directory-tree"
    - "npm files allowlist (not .npmignore) for safe tarball scoping"
    - "prepublishOnly runs build before every npm publish"

key-files:
  created:
    - plugin/.claude-plugin/plugin.json
    - plugin/commands/launch.md
    - plugin/commands/add.md
    - .claude-plugin/marketplace.json
    - LICENSE
  modified:
    - package.json

key-decisions:
  - "Plugin name set to claude-tree with command files launch.md and add.md, producing /claude-tree:launch and /claude-tree:add (cleaner UX than /claude-directory-tree:claude-tree)"
  - "commands/ directory at plugin/ root (not inside plugin/.claude-plugin/); only plugin.json goes in .claude-plugin/"
  - "plugin/ directory excluded from npm files allowlist; plugin is distributed via git/marketplace, not npm"
  - "pre-existing static asset path mismatch (server looks for dist/client/dist but vite outputs to client/dist) deferred to next plan"

patterns-established:
  - "Plugin manifest: name is namespace prefix, command filename is the command name"
  - "Marketplace catalog at .claude-plugin/marketplace.json with source pointing to plugin subdirectory"

requirements-completed: [DIST-01, DIST-02, DIST-03]

# Metrics
duration: 12min
completed: 2026-03-31
---

# Phase 4 Plan 01: Plugin Distribution Setup Summary

**Claude Code plugin with /claude-tree:launch and /claude-tree:add commands, npm package configured with files allowlist + prepublishOnly, and MIT license**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-31T05:06:05Z
- **Completed:** 2026-03-31T05:18:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created complete Claude Code plugin structure: manifest, two command files, marketplace catalog
- Configured npm package with files allowlist (dist/, README.md, LICENSE) and prepublishOnly script
- Added repository, homepage, author metadata to package.json
- Created MIT LICENSE file

## Task Commits

1. **Task 1: Create Claude Code plugin structure and marketplace manifest** - `4ea1696` (feat)
2. **Task 2: Configure npm package for distribution and create LICENSE** - `deb7c2a` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `plugin/.claude-plugin/plugin.json` - Plugin manifest with name claude-tree v0.1.0
- `plugin/commands/launch.md` - /claude-tree:launch command prompt (runs npx claude-directory-tree)
- `plugin/commands/add.md` - /claude-tree:add command prompt (runs npx claude-directory-tree --add)
- `.claude-plugin/marketplace.json` - Marketplace catalog pointing to ./plugin as source
- `package.json` - Added files, repository, homepage, author, prepublishOnly
- `LICENSE` - MIT license, Copyright 2026 Furqan Tariq

## Decisions Made

- Plugin name `claude-tree` with command files `launch.md` and `add.md` produces `/claude-tree:launch` and `/claude-tree:add` -- cleaner than `/claude-directory-tree:claude-tree` alternative
- `plugin/` excluded from npm `files` allowlist intentionally: plugin is installed via git marketplace, not npm consumers
- `npm pack --dry-run` confirmed tarball contains: `dist/cli.js`, `dist/server/index.js`, `LICENSE`, `package.json` (README.md will be added in Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

**Note on pre-existing issue discovered:** Static asset path in `src/server/static.ts` resolves client files at `join(__dirname, '../client/dist')` which points to `dist/client/dist` when bundled, but Vite outputs to `client/dist/`. This pre-dates this plan and is out of scope. Logged to `deferred-items.md` for Plan 02 handling.

## Issues Encountered

Two pre-existing test failures confirmed present before this plan's execution:
- `ContextMenu.test.tsx > disables copy/move for blocked types (hook)` -- UI test gap from prior work
- `server.test.ts > INFRA-03: port fallback` -- timeout/EADDRINUSE from test isolation issue

Neither was introduced by this plan's changes (verified via git stash).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plugin structure is complete and ready for `/plugin marketplace add furqantariq/claude-directory-tree` + `/plugin install claude-tree@claude-directory-tree`
- npm package is ready for `npm publish` once README.md is added (Plan 02)
- Static asset path mismatch must be resolved before `npx claude-directory-tree` serves the UI correctly from an npm install

---
*Phase: 04-plugin-distribution*
*Completed: 2026-03-31*
