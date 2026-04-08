# Requirements: Claude Directory Tree

**Defined:** 2026-03-28
**Core Value:** Make every Claude Code artifact visible and actionable across all projects and scopes from a single tree view.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: App launches via `npx claude-directory-tree` and opens localhost in browser
- [x] **INFRA-02**: Server runs on localhost only, no network calls, no telemetry
- [x] **INFRA-03**: Dynamic port allocation if default port is taken
- [x] **INFRA-04**: Sub-second startup with instant tree rendering for 15+ projects

### Scanning

- [x] **SCAN-01**: User can point the app at a parent directory to auto-discover all projects containing `.claude/` folders
- [x] **SCAN-02**: User can manually register additional project paths
- [x] **SCAN-03**: Scanner detects all Claude artifact types: skills, agents, commands, plugins, hooks, CLAUDE.md, MCP servers, memory files, plan files, channels
- [x] **SCAN-04**: Scanner distinguishes global scope (`~/.claude/`) from project scope (`.claude/`)

### Tree View

- [x] **TREE-01**: User sees a hierarchical tree with expand/collapse showing all artifacts organized by scope (global vs project)
- [x] **TREE-02**: Each artifact displays a type-specific icon and label
- [x] **TREE-03**: Scopes are visually grouped by section (global, current project, other projects) with section headers
- [x] **TREE-04**: Each scope/category node shows artifact count
- [x] **TREE-05**: Empty scopes/categories show a graceful empty state with guidance
- [x] **TREE-06**: User can manually refresh the tree to pick up file system changes
- [x] **TREE-07**: User can filter the tree by artifact type (e.g. "show all agents across all projects"). Unknown type excluded as scanner drops unclassifiable files.
- [x] **TREE-08**: User can search/filter artifacts by name with live filtering

### File Operations

- [x] **OPS-01**: User can click an artifact to open it in their system editor
- [x] **OPS-02**: User can right-click an artifact to see a context menu with type-specific actions
- [ ] **OPS-03**: User can navigate the tree with keyboard (arrow keys, enter to open, esc to close menu)
- [x] **OPS-04**: User can copy an artifact from one project to another (cmd+c/v or context menu)
- [x] **OPS-05**: User can move an artifact from one project to another
- [x] **OPS-06**: User can promote a project-local artifact to global scope
- [x] **OPS-07**: User can demote a global artifact to a specific project's local scope
- [x] **OPS-08**: Copy/move operations detect conflicts and prompt before overwriting
- [x] **OPS-09**: File operations use atomic writes to prevent corruption of settings.json and other config files

### Artifact Summary

- [x] **SUMM-01**: User can see a quick summary of what each artifact does (extracted from frontmatter/description) in a detail pane or similar UI element

### Directory View Toggle

- [x] **VIEW-01**: User can toggle between flat scope view and directory-hierarchy view that mirrors the real filesystem structure
- [x] **VIEW-02**: Non-Claude folders on the path to a project render as plain folder nodes with no artifacts
- [x] **VIEW-03**: User's view preference (flat vs directory) persists across sessions via localStorage

### Plugin Toggle

- [x] **PLUG-01**: User can click a toggle on a plugin to enable/disable it, writing to settings.json enabledPlugins
- [x] **PLUG-02**: Plugin enabled/disabled state reflects the current value in settings.json

### Distribution

- [x] **DIST-01**: `/claude-tree:launch` command in Claude Code starts the server and opens the browser (via plugin)
- [x] **DIST-02**: `npx claude-directory-tree` works from any directory without manual setup (via npm package)
- [x] **DIST-03**: Target directory defaults to project root (plugin context) or cwd (standalone), with optional override argument

### Cross-Platform

- [ ] **XPLAT-01**: Scanner decodes Windows-encoded project cache names (C-Users-... and C--Users-...) to valid Windows paths
- [ ] **XPLAT-02**: Scanner path operations use path.join/path.parse instead of hardcoded Unix separators (resolveProjectPath root, parent construction, segment splitting)
- [ ] **XPLAT-03**: Classifier memory cache encoding replaces backslashes and colons in addition to forward slashes and spaces
- [ ] **XPLAT-04**: Requirements traceability updated with Phase 5 cross-platform entries

## v2 Requirements

### Real-time Updates

- **WATCH-01**: Tree automatically updates when files change on disk (file watching)

### Conflict Detection

- **CONF-01**: App warns when a project-local artifact shadows a global one with the same name

### Batch Operations

- **BATCH-01**: User can select multiple artifacts and perform bulk copy/move/delete

### UX Enhancements

- **UX-01**: Command palette for keyboard-driven power users
- **UX-02**: Keyboard shortcut cheat sheet
- **UX-03**: Project tagging/grouping

## Out of Scope

| Feature | Reason |
|---------|--------|
| Inline file editor | Opens scope massively; system editor is better for this |
| Cloud hosting or remote access | Everything is local; security risk for hooks and MCP configs |
| Artifact creation wizard | This tool organizes, not generates |
| Mobile/tablet support | Desktop browser only |
| Diff/merge artifacts | Use git diff in terminal instead |
| Plugin/extension system | Premature; open source codebase is the extension mechanism |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| SCAN-01 | Phase 1 | Complete |
| SCAN-02 | Phase 1 | Complete |
| SCAN-03 | Phase 1 | Complete |
| SCAN-04 | Phase 1 | Complete |
| TREE-01 | Phase 2 | Complete |
| TREE-02 | Phase 2 | Complete |
| TREE-03 | Phase 2 | Complete |
| TREE-04 | Phase 2 | Complete |
| TREE-05 | Phase 2 | Complete |
| TREE-06 | Phase 2 | Complete |
| TREE-07 | Phase 2 | Complete |
| TREE-08 | Phase 2 | Complete |
| OPS-01 | Phase 3 | Complete |
| OPS-02 | Phase 3 | Complete |
| OPS-03 | Phase 3 | Pending |
| OPS-04 | Phase 3 | Complete |
| OPS-05 | Phase 3 | Complete |
| OPS-06 | Phase 3 | Complete |
| OPS-07 | Phase 3 | Complete |
| OPS-08 | Phase 3 | Complete |
| OPS-09 | Phase 3 | Complete |
| SUMM-01 | Phase 3 | Complete |
| VIEW-01 | Phase 3.1 | Complete |
| VIEW-02 | Phase 3.1 | Complete |
| VIEW-03 | Phase 3.1 | Complete |
| PLUG-01 | Phase 3.1 | Complete |
| PLUG-02 | Phase 3.1 | Complete |
| DIST-01 | Phase 4 | Complete |
| DIST-02 | Phase 4 | Complete |
| DIST-03 | Phase 4 | Complete |
| XPLAT-01 | Phase 5 | Pending |
| XPLAT-02 | Phase 5 | Pending |
| XPLAT-03 | Phase 5 | Pending |
| XPLAT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-31 after Phase 4 planning*
