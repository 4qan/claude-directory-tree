# Claude Directory Tree

## What This Is

A local web app that gives Claude Code users a visual file-explorer view of all their Claude artifacts (skills, agents, commands, plugins, hooks, CLAUDE.md files, MCP servers, memory files, and plans) across global scope and all projects. It lets users discover what exists, move artifacts between projects/scopes, and open files in their system editor. Distributed as an open-source npm package, zero-install via `npx`.

## Core Value

Make every Claude Code artifact visible and actionable across all projects and scopes from a single tree view, so users never lose track of what exists where.

## Requirements

### Validated

(None yet -- ship to validate)

### Active

- [ ] Tree view of all Claude artifacts organized by scope (global vs project)
- [ ] Support all artifact types: skills, agents, commands, plugins, hooks, CLAUDE.md, MCP servers, memory files, plan files
- [ ] Auto-scan a parent directory to discover projects with .claude/ folders
- [ ] Manual project registration alongside auto-scan
- [ ] Copy/move artifacts between projects (cmd+c/v, right-click context menu)
- [ ] Promote local artifact to global and demote global to project-local
- [ ] Quick summary of each artifact (what it does) visible in the tree or on hover
- [ ] Open artifact in system editor on click
- [ ] Right-click context menu with artifact-specific actions
- [ ] Zero-install: runs via `npx claude-directory-tree` opening localhost in browser
- [ ] Fast startup and responsive UI

### Out of Scope

- Cloud hosting or remote access -- everything is local
- Inline editing or code preview within the app -- open in system editor instead
- Mobile or tablet support -- desktop browser only
- Artifact creation wizard -- users create artifacts in their editor, this tool organizes them
- Real-time file watching in v1 -- manual refresh is acceptable

## Context

- Target user: Claude Code power users who live in the terminal all day, managing 5-15+ projects
- The pain is that Claude Code artifacts are scattered across `~/.claude/` (global) and per-project `.claude/` directories with no unified view
- Moving artifacts between scopes currently requires knowing exact file paths and manually copying/renaming
- The UI should feel like a native file explorer (macOS Finder or VS Code sidebar), not a custom dashboard
- Open source from day one so the community can extend it
- User (Furqan) is not a developer, so contributor-friendliness matters

## Constraints

- **Distribution**: npm package, zero dependencies beyond Node.js
- **Runtime**: Local only, no network calls, no telemetry
- **Performance**: Sub-second startup, instant tree rendering for 15+ projects
- **Compatibility**: macOS primary (user's platform), Linux/Windows as secondary targets
- **License**: Open source (MIT or similar permissive license)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over CLI | Need right-click menus, visual tree, cmd+c/v -- terminal can't do this well | -- Pending |
| npx distribution | Zero-install is highest priority for accessibility | -- Pending |
| Open source | User wants community contributions, free for everyone | -- Pending |
| System editor for file opening | Avoid building an inline editor; focus on what matters (discovery + moving) | -- Pending |

---
*Last updated: 2026-03-28 after initialization*
