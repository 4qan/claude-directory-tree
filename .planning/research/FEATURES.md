# Feature Research

**Domain:** File explorer / artifact management tool for Claude Code
**Researched:** 2026-03-28
**Confidence:** HIGH (core UX patterns), MEDIUM (Claude-specific artifact behavior)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume any file explorer or developer tool management UI has. Missing these makes the product feel broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hierarchical tree view with expand/collapse | Every file explorer since Windows 95 works this way | LOW | Scope root (global / per-project) as top-level nodes |
| Artifact type icons and labels | Users need visual distinction between a skill, agent, hook, CLAUDE.md, MCP config, etc. | LOW | Map each artifact type to a distinct icon; type label in the row |
| Click to open in system editor | Primary action for any file manager | LOW | Use `$EDITOR`, `open`, or `xdg-open` depending on OS |
| Right-click context menu | Standard for file explorers; power users expect it | MEDIUM | Actions vary by artifact type (e.g., hooks get "run now", agents get "copy to project") |
| Keyboard navigation (arrow keys, enter, esc) | Every tree UI supports this; W3C ARIA tree pattern | MEDIUM | Arrow keys to move focus, Enter to open, Escape to close context menu |
| Search / filter by name | Required when managing 10+ artifacts across 10+ projects | MEDIUM | Live filter that narrows tree nodes without collapsing structure |
| Scope labels (global vs project) | Without this, users can't tell where an artifact lives | LOW | Color or badge differentiation between `~/.claude/` and `.claude/` |
| Artifact count per scope | At-a-glance health check | LOW | Count displayed next to each scope header |
| Manual refresh | File system changes may happen outside the app | LOW | Refresh button in toolbar; keyboard shortcut |
| Graceful empty states | User lands on a project with no artifacts; must not feel broken | LOW | Empty state with a hint about where to create artifacts |

### Differentiators (Competitive Advantage)

Features that justify why this tool exists instead of just using Finder or `ls`.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified multi-project tree | The core pain: artifacts are scattered across N project `.claude/` dirs and `~/.claude/`. No tool unifies them. | HIGH | Auto-scan a parent directory for `.claude/` folders + manual project registration |
| Promote / demote artifacts between scopes | Moving a skill from project-local to global requires knowing file paths today. This makes it one action. | MEDIUM | Moves file to correct directory in `~/.claude/` or `.claude/`; handles duplicates |
| Copy / move across projects | Reusing an agent from project A in project B currently means manual cp commands | MEDIUM | Drag-and-drop or cmd+c/v between tree nodes; show conflict dialog if file exists |
| Artifact type awareness | This tool knows what a Claude Code skill, agent, hook, and MCP config IS. Generic file explorers don't. | MEDIUM | Type-specific context menus, type badges, type-specific empty states |
| Inline artifact summary on hover | Shows the YAML frontmatter description or first paragraph of a skill/agent without opening the file | MEDIUM | Parse top of file for description; show in tooltip or detail panel |
| Auto-discovery of projects | Power users have 15+ projects. Manual registration doesn't scale. | MEDIUM | Scan configurable parent directory; detect presence of `.claude/` or `.mcp.json` |
| Filter by artifact type | "Show me all agents across all projects" is a cross-project query no tool supports today | LOW | Multi-select type filter chips in toolbar |
| Scope conflict detection | Warn when a local artifact shadows a global one with the same name | MEDIUM | Surface as warning badge in tree |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Inline file editor | Convenience; avoid switching to editor | Recreates a bad version of VSCode. Increases scope massively. No syntax highlighting, no git diff, no undo history. | Open in system editor. Focus on discovery and moving, not editing. |
| Real-time file watching (v1) | "Automatically refresh when files change" | Requires OS-level file watcher (chokidar), adds complexity, can cause infinite loops if artifact operations trigger watches | Manual refresh button. Add file watching in v1.x after core is stable. |
| Artifact creation wizard | "Help me create a new skill" | This tool is an organizer, not a generator. Wizards suggest understanding artifact syntax deeply enough to template it -- that's a different product. | Open the artifact directory in system editor; user creates files there. |
| Cloud sync or remote access | "Access my artifacts from anywhere" | Requires auth, storage backend, conflict resolution. Completely out of scope for a local tool. Security risk for hooks and MCP configs. | Stay local. If users want sync, they can git-commit their `.claude/` dirs. |
| Diff / merge artifacts | "Show me what changed between versions" | Requires git integration or custom diff logic. Adds complexity without being the core use case. | Open in system editor; use git diff in terminal. |
| Bulk operations via checkboxes | "Select 10 artifacts and move them all" | Multi-select + batch move/copy is complex (conflict resolution per item, partial failure state, undo). | Implement single-item operations first; add multi-select in v1.x once flows are stable. |
| Plugin/extension system | "Let the community extend it" | Too early. Premature extensibility adds architecture overhead before the core is validated. | Open source codebase IS the extension mechanism for now. |

## Feature Dependencies

```
Auto-scan project discovery
    └──requires──> Directory scanning (fs.readdirSync over parent dir)

Copy/move artifacts
    └──requires──> Tree view (source + destination nodes)
    └──requires──> Conflict detection (file already exists at target)

Promote/demote (scope change)
    └──requires──> Copy/move artifacts
    └──requires──> Scope labels (know source and destination scope)

Inline artifact summary (hover)
    └──requires──> Artifact type awareness (know which files to parse)

Scope conflict detection
    └──requires──> Artifact type awareness
    └──requires──> Unified multi-project tree

Filter by artifact type
    └──requires──> Artifact type awareness
    └──requires──> Tree view

Search by name
    └──enhances──> Filter by artifact type (combine for "all agents named 'reviewer'")

Right-click context menu
    └──requires──> Artifact type awareness (type-specific actions)
    └──enhances──> Copy/move, promote/demote, open in editor
```

### Dependency Notes

- **Copy/move requires conflict detection:** Without it, silent overwrites are a data loss risk for hooks and carefully-tuned agents.
- **Promote/demote requires copy/move:** Promotion is just a scoped move -- it's the same operation with a fixed destination (`~/.claude/`).
- **Scope conflict detection requires unified tree:** You can only detect shadowing if both scopes are visible simultaneously.
- **Filter by type requires type awareness:** Type awareness must be implemented first (artifact type detection from path + file structure).

## MVP Definition

### Launch With (v1)

- [ ] Hierarchical tree view (global scope + per-project scope) -- without this, nothing else matters
- [ ] Auto-scan parent directory for projects with `.claude/` folders + manual registration
- [ ] Artifact type detection and icons (skills, agents, commands, hooks, CLAUDE.md, MCP config, memory, plans)
- [ ] Click to open in system editor
- [ ] Right-click context menu (open, copy to project, promote to global, demote to project)
- [ ] Copy / move artifacts between scopes and projects with conflict detection
- [ ] Search / filter by name
- [ ] Manual refresh
- [ ] `npx claude-directory-tree` launches localhost in browser, zero install

### Add After Validation (v1.x)

- [ ] Filter by artifact type -- add when users report needing cross-project queries
- [ ] Inline artifact summary on hover -- add when users report difficulty identifying artifacts by filename alone
- [ ] Real-time file watching -- add when users report friction with manual refresh
- [ ] Scope conflict detection (shadowing warnings) -- add when users report confusion about which artifact is active

### Future Consideration (v2+)

- [ ] Multi-select + batch operations -- defer until single-item flows are proven stable
- [ ] Keyboard shortcut cheat-sheet / command palette -- defer until power users request it
- [ ] Project tagging / grouping -- defer until user base is large enough to surface organizational patterns

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified multi-project tree view | HIGH | MEDIUM | P1 |
| Auto-scan project discovery | HIGH | MEDIUM | P1 |
| Artifact type detection + icons | HIGH | LOW | P1 |
| Open in system editor | HIGH | LOW | P1 |
| Copy/move artifacts | HIGH | MEDIUM | P1 |
| Promote / demote scope | HIGH | LOW (built on copy/move) | P1 |
| Right-click context menu | HIGH | MEDIUM | P1 |
| Search / filter by name | MEDIUM | MEDIUM | P1 |
| Manual refresh | MEDIUM | LOW | P1 |
| Filter by artifact type | MEDIUM | LOW | P2 |
| Inline artifact summary (hover) | MEDIUM | MEDIUM | P2 |
| Scope conflict detection | MEDIUM | MEDIUM | P2 |
| Real-time file watching | LOW | HIGH | P3 |
| Multi-select batch operations | LOW | HIGH | P3 |

## Competitor Feature Analysis

No direct competitor exists for Claude Code artifact management. Closest analogues:

| Feature | VS Code Explorer | macOS Finder | Our Approach |
|---------|-----------------|--------------|--------------|
| Unified multi-scope tree | No (single workspace) | No (single filesystem location) | Primary differentiator: global + N projects in one tree |
| Artifact type awareness | No (generic files) | No (generic files) | Type detection from path patterns + file content |
| Promote/demote scope | No | No (manual cp) | First-class action, one click |
| Context menu | Yes (generic) | Yes (generic) | Type-specific actions (e.g., only skills show "view triggers") |
| Search | Yes | Yes (Spotlight) | In-tree live filter, scoped to Claude artifacts only |
| Open in editor | Yes | Yes | Yes (delegate to $EDITOR or OS default) |

## Sources

- VS Code Explorer UX patterns: [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview), [Context Menus](https://code.visualstudio.com/api/ux-guidelines/context-menus)
- Tree view interaction standards: [W3C ARIA Tree Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/), [Carbon Design System Tree View](https://carbondesignsystem.com/components/tree-view/usage/), [PatternFly Tree View](https://www.patternfly.org/components/tree-view/design-guidelines/)
- Claude Code artifact structure: [Complete .claude Directory Guide](https://computingforgeeks.com/claude-code-dot-claude-directory-guide/), [Claude Code Settings Docs](https://code.claude.com/docs/en/settings), [Understanding Claude Code's Full Stack](https://alexop.dev/posts/understanding-claude-code-full-stack/)
- Claude Code configuration scopes: [Claude Code Settings](https://code.claude.com/docs/en/settings) -- confirmed 4 scopes: Managed, User (~/.claude/), Project (.claude/), Local (.claude/settings.local.json)

---
*Feature research for: Claude Code artifact browser (claude-directory-tree)*
*Researched: 2026-03-28*
