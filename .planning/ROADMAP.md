# Roadmap: Claude Directory Tree

## Overview

Three phases in dependency order: scaffold the working binary and scanner first, then deliver the read-only tree view that proves the core value, then layer in write operations and artifact summaries to complete v1. Each phase is independently shippable and verifiable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Working npx binary, artifact scanner, and server with typed REST API
- [ ] **Phase 2: Tree View** - Read-only artifact tree with search, filter, refresh, and scope labels
- [ ] **Phase 3: Operations** - File copy/move/promote/demote, context menu, keyboard nav, and artifact summaries

## Phase Details

### Phase 1: Foundation
**Goal**: Users can run `npx claude-directory-tree`, have it open a browser, and retrieve a fully typed artifact tree via the API
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, SCAN-01, SCAN-02, SCAN-03, SCAN-04
**Success Criteria** (what must be TRUE):
  1. `npx claude-directory-tree` starts without errors and opens localhost in the browser
  2. A second launch on the same machine does not fail due to port conflict
  3. `GET /api/scan` returns a correctly typed artifact tree with all artifact types detected (skills, agents, commands, plugins, hooks, CLAUDE.md, MCP servers, memory files, plan files)
  4. Global scope (`~/.claude/`) is distinguished from per-project scope in the API response
  5. The server binds to `127.0.0.1` only and does not accept external network connections
**Plans**: TBD

### Phase 2: Tree View
**Goal**: Users can see all their Claude artifacts organized by scope in an interactive tree, and find specific artifacts by name or type
**Depends on**: Phase 1
**Requirements**: TREE-01, TREE-02, TREE-03, TREE-04, TREE-05, TREE-06, TREE-07, TREE-08
**Success Criteria** (what must be TRUE):
  1. User sees a hierarchical tree with global and per-project scopes, each expandable and collapsible
  2. Each artifact shows a type-specific icon, a label, and a scope badge (global/project); category nodes show artifact counts
  3. User can type in a search box and the tree filters live to matching artifact names
  4. User can select a type filter (e.g. "agents") and see only that artifact type across all scopes
  5. User can click a refresh button and the tree updates to reflect file system changes
**Plans**: TBD

### Phase 3: Operations
**Goal**: Users can open, copy, move, promote, and demote artifacts without leaving the app, and see a quick summary of what each artifact does
**Depends on**: Phase 2
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09, SUMM-01
**Success Criteria** (what must be TRUE):
  1. User can click an artifact and it opens in their system editor
  2. User can right-click an artifact and see a context menu with type-appropriate actions (copy, move, promote to global, demote to project)
  3. User can copy or move an artifact to another project; if a conflict exists the app prompts before overwriting
  4. User can navigate the tree with keyboard (arrow keys, Enter to open, Esc to close menu) without touching the mouse
  5. User can see a short summary of what each artifact does without opening the file
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/? | Not started | - |
| 2. Tree View | 0/? | Not started | - |
| 3. Operations | 0/? | Not started | - |
