# Backlog

Feature ideas and enhancements captured during development. Candidates for future phases.

## Directory View Toggle

**Priority:** High
**Source:** User feedback during Phase 2

Add a toggle to switch between the current flat scope view and a directory-hierarchy view that mirrors the real filesystem structure.

**Flat view (current):**
```
> Global (~/.claude)
> Frontify
> zakat-app
```

**Directory view:**
```
> ~/.claude (Global)
> Documents
  > Work
    > ProductPeople
      > Clients
        > Frontify
  > Projects
    > zakat-app
```

Non-Claude folders render as plain folders with no artifacts. Only folders on the path to a project with artifacts are shown.

**Requires:**
- Backend: return actual project paths (not just labels) in ScopeNode
- Frontend: new tree-building algorithm to construct directory hierarchy from paths
- Path merging: collapse overlapping prefixes (e.g., two projects under `Documents/Work/Clients/`)
- Toggle UI: small text button like the expand/collapse toggle, placed near it
- State: remember user's preference (flat vs directory)

## Plugin Enable/Disable Toggle

**Priority:** Medium
**Source:** User feedback during Phase 2

Allow enabling/disabling plugins directly from the tree UI (currently shows enabled/disabled pill as read-only). Would write to `~/.claude/settings.json` `enabledPlugins` field.
