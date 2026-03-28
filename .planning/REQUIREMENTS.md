# Requirements: Claude Directory Tree

**Defined:** 2026-03-28
**Core Value:** Make every Claude Code artifact visible and actionable across all projects and scopes from a single tree view.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: App launches via `npx claude-directory-tree` and opens localhost in browser
- [ ] **INFRA-02**: Server runs on localhost only, no network calls, no telemetry
- [ ] **INFRA-03**: Dynamic port allocation if default port is taken
- [ ] **INFRA-04**: Sub-second startup with instant tree rendering for 15+ projects

### Scanning

- [ ] **SCAN-01**: User can point the app at a parent directory to auto-discover all projects containing `.claude/` folders
- [ ] **SCAN-02**: User can manually register additional project paths
- [ ] **SCAN-03**: Scanner detects all Claude artifact types: skills, agents, commands, plugins, hooks, CLAUDE.md, MCP servers, memory files, plan files, channels
- [ ] **SCAN-04**: Scanner distinguishes global scope (`~/.claude/`) from project scope (`.claude/`)

### Tree View

- [ ] **TREE-01**: User sees a hierarchical tree with expand/collapse showing all artifacts organized by scope (global vs project)
- [ ] **TREE-02**: Each artifact displays a type-specific icon and label
- [ ] **TREE-03**: Each scope node shows a badge indicating global or project-local
- [ ] **TREE-04**: Each scope/category node shows artifact count
- [ ] **TREE-05**: Empty scopes/categories show a graceful empty state with guidance
- [ ] **TREE-06**: User can manually refresh the tree to pick up file system changes
- [ ] **TREE-07**: User can filter the tree by artifact type (e.g. "show all agents across all projects")
- [ ] **TREE-08**: User can search/filter artifacts by name with live filtering

### File Operations

- [ ] **OPS-01**: User can click an artifact to open it in their system editor
- [ ] **OPS-02**: User can right-click an artifact to see a context menu with type-specific actions
- [ ] **OPS-03**: User can navigate the tree with keyboard (arrow keys, enter to open, esc to close menu)
- [ ] **OPS-04**: User can copy an artifact from one project to another (cmd+c/v or context menu)
- [ ] **OPS-05**: User can move an artifact from one project to another
- [ ] **OPS-06**: User can promote a project-local artifact to global scope
- [ ] **OPS-07**: User can demote a global artifact to a specific project's local scope
- [ ] **OPS-08**: Copy/move operations detect conflicts and prompt before overwriting
- [ ] **OPS-09**: File operations use atomic writes to prevent corruption of settings.json and other config files

### Artifact Summary

- [ ] **SUMM-01**: User can see a quick summary of what each artifact does (extracted from frontmatter/description) in a detail pane or similar UI element

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
| INFRA-01 | - | Pending |
| INFRA-02 | - | Pending |
| INFRA-03 | - | Pending |
| INFRA-04 | - | Pending |
| SCAN-01 | - | Pending |
| SCAN-02 | - | Pending |
| SCAN-03 | - | Pending |
| SCAN-04 | - | Pending |
| TREE-01 | - | Pending |
| TREE-02 | - | Pending |
| TREE-03 | - | Pending |
| TREE-04 | - | Pending |
| TREE-05 | - | Pending |
| TREE-06 | - | Pending |
| TREE-07 | - | Pending |
| TREE-08 | - | Pending |
| OPS-01 | - | Pending |
| OPS-02 | - | Pending |
| OPS-03 | - | Pending |
| OPS-04 | - | Pending |
| OPS-05 | - | Pending |
| OPS-06 | - | Pending |
| OPS-07 | - | Pending |
| OPS-08 | - | Pending |
| OPS-09 | - | Pending |
| SUMM-01 | - | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after initial definition*
