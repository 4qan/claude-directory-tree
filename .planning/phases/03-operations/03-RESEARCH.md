# Phase 3: Operations - Research

**Researched:** 2026-03-29
**Domain:** File operations, context menus, keyboard navigation, artifact summaries
**Confidence:** HIGH

## Summary

Phase 3 builds on a working React 19 + Fastify 5 codebase (Phases 1-2 complete). The domain splits cleanly into: (1) server-side file operations via new Fastify routes, (2) client-side UI for context menus, selection state, and a detail panel. All dependencies needed are already installed — `open` for launching system editor/finder, `write-file-atomic` for safe writes, `gray-matter` for frontmatter parsing, Node.js `fs` for copy/move. No new npm installs required.

The most important pre-planning finding is the promote/demote artifact safety matrix below. Hooks and MCP configs are virtual artifacts (synthesized from JSON entries, not standalone files) and cannot be treated as copyable files. Plugin promote/demote is technically possible but has a known gap: enabled state in `settings.json` does not transfer. All other artifact types (commands, agents, skills, memory, plans, CLAUDE.md) are standalone markdown files and are safe to promote/demote.

**Primary recommendation:** Implement file operations as five dedicated Fastify routes under `src/server/routes/operations.ts`, use Node.js `fs.cp` (recursive for plugins) for copy, `fs.rename`/`fs.cp+unlink` for move, and the `open` package (already installed) for editor/folder launch. Keep all filesystem logic server-side; client only calls fetch.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Context menu design**
- Custom styled dropdown menu (Tailwind-styled, matching app theme, with icons and separators)
- Leaf artifacts get the full action menu: Open in Editor, Copy to..., Move to..., separator, Promote to Global / Demote to Project
- Scope nodes get a minimal menu: "Open folder" only (opens .claude/ directory in OS file manager)
- Category nodes: no context menu

**Click behavior**
- Single-click on artifact: selects it and shows summary in side panel
- Double-click on artifact: opens in system editor
- Single-click on scope/category: expand/collapse (existing headless-tree behavior)
- Double-click on scope/category: same as single-click (expand/collapse only)

**Copy/move destination UX**
- Context menu "Copy to..." / "Move to..." expands into a flyout submenu listing all available projects
- For now, simple list. If many projects, a type-to-filter within the submenu can be added (Claude's discretion)
- Conflict resolution: confirmation dialog with Cancel/Replace buttons
- Success feedback: toast notification, auto-dismiss after a few seconds

**Clipboard shortcuts**
- Cmd+C copies selected artifact to clipboard state, Cmd+V pastes into the currently focused scope/project
- Both clipboard shortcuts and context menu actions supported

**Artifact summary display**
- Side panel to the right of the tree, appears only when an artifact is selected
- Panel shows: name, type, scope, path, and description
- Description source: primary is YAML frontmatter `description` field, fallback to first non-frontmatter paragraph
- Panel hidden when nothing is selected (tree gets full width)

**Keyboard navigation**
- Full keyboard workflow: arrow keys to navigate, Enter to open/select, Esc to close menu
- Cmd+C/V for copy/paste operations
- Shift+F10 or Menu key opens context menu on focused item
- Tab cycles focus zones: toolbar search -> type filter -> tree
- Escape returns focus to tree from anywhere
- Cmd+F jumps directly to search box

### Claude's Discretion
- Context menu component implementation (custom or lightweight library)
- Toast notification library/implementation
- Side panel transition/animation style
- Flyout submenu behavior when project list is long (type-to-filter threshold)
- Server API endpoint design for file operations
- Filesystem operation implementation details (beyond write-file-atomic)
- Focus management edge cases

### Deferred Ideas (OUT OF SCOPE)
None. Discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPS-01 | User can click an artifact to open it in their system editor | `open` package (v11, already installed) — `open(absolutePath)` opens in default app |
| OPS-02 | User can right-click an artifact to see a context menu with type-specific actions | Custom Tailwind dropdown; `onContextMenu` handler on TreeItem leaf divs |
| OPS-03 | User can navigate the tree with keyboard (arrow keys, enter to open, esc to close menu) | headless-tree `selectionFeature` + `hotkeysCoreFeature`; manual keydown handlers for custom shortcuts |
| OPS-04 | User can copy an artifact from one project to another (cmd+c/v or context menu) | POST /api/operations/copy — Node.js `fs.cp` for files, recursive for plugin dirs |
| OPS-05 | User can move an artifact from one project to another | POST /api/operations/move — `fs.rename` (same device) or `fs.cp + fs.unlink` (cross-device) |
| OPS-06 | User can promote a project-local artifact to global scope | POST /api/operations/promote — same as copy but destination is `~/.claude/{type-dir}/` |
| OPS-07 | User can demote a global artifact to a specific project's local scope | POST /api/operations/demote — copy to project `.claude/{type-dir}/`, then unlink source |
| OPS-08 | Copy/move operations detect conflicts and prompt before overwriting | `fs.access` check server-side returns 409 conflict; client shows dialog |
| OPS-09 | File operations use atomic writes to prevent corruption | `write-file-atomic` for file content rewrites; for raw copy use `fs.cp` to temp then `fs.rename` |
| SUMM-01 | User can see a quick summary of what each artifact does | `gray-matter` (already installed) parses frontmatter; first paragraph extraction is plain string split |
</phase_requirements>

---

## Standard Stack

### Core (already installed — zero new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `open` | 11.0.0 | Open files in system editor, folders in Finder/Explorer | Already installed; `open(path)` uses `xdg-open`/`open`/`start` per OS |
| `write-file-atomic` | 7.0.1 | Atomic file writes (temp+rename) | Already installed and used in config layer |
| `gray-matter` | 4.0.3 | YAML frontmatter parsing for descriptions | Already installed and used in scanner |
| `node:fs/promises` | Node 20 | `fs.cp`, `fs.rename`, `fs.access`, `fs.mkdir` | Built-in; no install |
| `@headless-tree/core` | 1.6.3 | `selectionFeature`, `hotkeysCoreFeature` for selection + keyboard | Already installed |

### No New Installs Required

All dependencies for Phase 3 are already in `package.json`. The `open` package handles cross-platform editor/folder launching. `gray-matter` handles description extraction. `write-file-atomic` handles safe writes. `node:fs` handles copy/move/conflict detection.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure additions

```
src/
├── server/
│   └── routes/
│       ├── scan.ts             # existing
│       └── operations.ts       # NEW: copy, move, promote, demote, open, open-folder
client/src/
├── components/
│   ├── tree/
│   │   ├── ArtifactTree.tsx    # extend: selection state, clipboard, keyboard
│   │   └── TreeItem.tsx        # extend: onClick, onDoubleClick, onContextMenu, selected style
│   ├── ContextMenu.tsx         # NEW: custom Tailwind dropdown + flyout submenu
│   ├── ArtifactDetailPanel.tsx # NEW: right-side summary panel
│   ├── ConflictDialog.tsx      # NEW: uses existing @radix-ui Dialog via shadcn card/button
│   └── Toast.tsx               # NEW: custom lightweight toast stack
```

### Pattern 1: Server Route for File Operations

All file operations are POST requests with a Zod-validated body. The route file follows the same pattern as `scan.ts` — register via `withTypeProvider<ZodTypeProvider>()`, define request/response Zod schemas, return structured error on conflict.

```typescript
// src/server/routes/operations.ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import open from 'open';
import { z } from 'zod';

const CopyRequestSchema = z.object({
  sourcePath: z.string(),      // absolutePath from Artifact
  destinationDir: z.string(),  // target .claude/{type-dir}/ absolute path
  overwrite: z.boolean().default(false),
});

const OperationResultSchema = z.object({
  success: z.boolean(),
  destPath: z.string().optional(),
  conflict: z.boolean().optional(), // true when file exists and overwrite=false
});

export async function operationsRoutes(server: FastifyInstance) {
  (server as FastifyInstance).withTypeProvider<ZodTypeProvider>()
    .post('/api/operations/copy', { schema: { body: CopyRequestSchema, response: { 200: OperationResultSchema } } },
      async (req) => {
        const { sourcePath, destinationDir, overwrite } = req.body;
        const destPath = path.join(destinationDir, path.basename(sourcePath));
        if (!overwrite) {
          try { await fs.access(destPath); return { success: false, conflict: true }; } catch {}
        }
        await fs.mkdir(destinationDir, { recursive: true });
        await fs.cp(sourcePath, destPath, { recursive: true });
        return { success: true, destPath };
      }
    );
}
```

Source: existing `scan.ts` pattern + Node.js `fs` docs.

### Pattern 2: Open in System Editor

```typescript
// POST /api/operations/open
// body: { path: string }
import open from 'open';

// Open file in default system editor (VS Code, TextEdit, etc.)
await open(absolutePath);

// Open directory in Finder/Explorer (for scope "Open Folder")
await open(directoryPath);
```

`open` v11 is ESM-only, matches project's `"type": "module"`. Calling `open(path)` on macOS invokes `/usr/bin/open`, which respects the user's default app associations. No `app` option needed — let the OS decide.

Source: `open` package README, verified against installed v11.0.0.

### Pattern 3: headless-tree Selection Feature

```typescript
// In useTree config — add selectionFeature and hotkeysCoreFeature
import { syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature } from '@headless-tree/core';

const tree = useTree<TreeNodeData>({
  // ... existing config ...
  features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  state: {
    selectedItems: selectedIds,      // string[] controlled state
    focusedItem: focusedId,          // string | null controlled state
  },
  setSelectedItems: (updater) => setSelectedIds(updater),
  setFocusedItem: (updater) => setFocusedId(updater),
  onPrimaryAction: (item) => {
    // Called on Enter key press — open in editor if leaf
    if (item.getItemData().nodeKind === 'leaf') {
      handleOpenInEditor(item.getItemData() as Artifact);
    }
  },
});

// Check selection in TreeItem:
const isSelected = item.isSelected(); // boolean from selectionFeature
```

`selectionFeature` adds `item.isSelected()`, `item.selectUpTo()`, `setSelectedItems` to the tree config. `hotkeysCoreFeature` is the prerequisite for all keyboard hotkeys in headless-tree. Arrow key navigation is built-in once `hotkeysCoreFeature` is included.

Source: headless-tree `@headless-tree/core` v1.6.3 type definitions verified at `node_modules/@headless-tree/core/dist/index.d.ts`.

### Pattern 4: Frontmatter Description Extraction

```typescript
// Reuse gray-matter (already used in classify.ts)
import matter from 'gray-matter';
import fs from 'node:fs/promises';

async function extractDescription(absolutePath: string): Promise<string | null> {
  // Fast path: description already in Artifact.frontmatter from scanner
  // artifact.frontmatter?.description is available without re-reading file
  if (artifact.frontmatter?.description) {
    return String(artifact.frontmatter.description);
  }

  // Fallback: read file and extract first non-frontmatter paragraph
  try {
    const raw = await fs.readFile(absolutePath, 'utf-8');
    const { content } = matter(raw);
    const firstParagraph = content.trim().split(/\n\n+/)[0]?.trim();
    return firstParagraph || null;
  } catch {
    return null;
  }
}
```

**Key insight:** The scanner already parses frontmatter and stores it in `Artifact.frontmatter`. The detail panel can read `artifact.frontmatter?.description` directly from the tree data without any API call. Fallback paragraph extraction only needed client-side for artifacts without a `description` field in frontmatter.

### Pattern 5: Conflict Detection

```typescript
// Server: check before copy/move
async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; }
  catch { return false; }
}

// Return 200 with conflict:true rather than 4xx
// Client shows ConflictDialog, user clicks Replace -> re-POST with overwrite:true
```

### Anti-Patterns to Avoid

- **Do NOT use `fs.copyFile` for plugins.** Plugins are directories (`plugins/name/`). Use `fs.cp(src, dest, { recursive: true })` which handles both files and directories uniformly.
- **Do NOT attempt to copy/move virtual artifacts (hooks, MCP configs) as files.** Their `absolutePath` contains `#` fragment identifiers (e.g., `settings.json#hookId`). These are composite keys into JSON, not real file paths.
- **Do NOT import `open` as CommonJS.** `open` v11 is ESM-only. The server uses `"type": "module"` + tsup, so ESM imports work fine.
- **Do NOT call `fs.rename` across devices.** macOS global `~/.claude` and a project directory may be on different volumes. Use `fs.cp` + `fs.unlink` for move when source and destination are on different filesystems.

---

## Promote/Demote Safety Matrix (Pre-mortem)

This is the key research finding requested in CONTEXT.md. Each artifact type assessed for promote/demote safety.

| Artifact Type | Physical Form | Promote/Demote | Notes |
|---------------|--------------|----------------|-------|
| `command` | `.claude/commands/name.md` | **SAFE** | Standalone file, no scope-specific references |
| `agent` | `.claude/agents/name.md` | **SAFE** | Standalone file |
| `skill` | `.claude/skills/name/SKILL.md` (dir) | **SAFE** | Directory copy via `fs.cp` recursive |
| `memory` | `.claude/memory/name.md` | **SAFE** | Standalone file; project memory in `~/.claude/projects/{encoded}/memory/` is different path, but copy is valid |
| `plan` | `.claude/plans/name.md` | **SAFE** | Standalone file |
| `claude-md` | `.claude/CLAUDE.md` | **ALLOWED WITH CAVEAT** | Copy is technically safe; semantically odd (global CLAUDE.md serves different purpose). Allow but do not make it the default workflow. Destination is `~/.claude/CLAUDE.md` — if exists, conflict dialog triggers. |
| `plugin` | `.claude/plugins/name/` (dir) | **ALLOWED WITH KNOWN GAP** | Directory copy via `fs.cp` recursive works. However `enabledPlugins` in `settings.json` (keyed as `name@marketplace`) does NOT transfer. Plugin appears in new scope but will default to disabled. This is acceptable behavior. |
| `hook` | `settings.json#hookId` (virtual) | **BLOCKED** | Synthetic artifact — `absolutePath` is `settings.json#hookId`, not a real file path. Moving requires surgical JSON editing inside `settings.json`. Out of scope for Phase 3. Surface disabled state in context menu. |
| `mcp-config` | `.mcp.json#serverName` or `.claude.json#serverName` (virtual) | **BLOCKED** | Synthetic artifact. MCP server configs contain scope-specific path arguments (e.g., `--project-dir /path/to/project`). Silently copying these to global scope would produce broken configs. Surface disabled state in context menu. |

**Implementation rule:** When building the context menu, check `artifact.type`. If type is `hook` or `mcp-config`, render "Promote to Global" / "Demote to Project" menu items as disabled (grayed out, not hidden) with a tooltip: "Hooks are managed in settings.json" / "MCP configs require manual scope editing".

**Destination directory mapping** (for promote/demote route):

| Artifact Type | Source (project) | Destination (global promote) |
|---------------|-----------------|------------------------------|
| `command` | `.claude/commands/name.md` | `~/.claude/commands/name.md` |
| `agent` | `.claude/agents/name.md` | `~/.claude/agents/name.md` |
| `skill` | `.claude/skills/name/` | `~/.claude/skills/name/` |
| `memory` | `.claude/memory/name.md` | `~/.claude/memory/name.md` |
| `plan` | `.claude/plans/name.md` | `~/.claude/plans/name.md` |
| `claude-md` | `.claude/CLAUDE.md` | `~/.claude/CLAUDE.md` |
| `plugin` | `.claude/plugins/name/` | `~/.claude/plugins/name/` |

The source path is `artifact.absolutePath`. The destination dir can be derived by replacing the project's `.claude/` prefix with `~/.claude/` and keeping the relative subdirectory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Open file in system editor | Custom shell exec, child_process | `open` v11 (installed) | Handles macOS/Linux/Windows, respects default apps |
| Atomic file write | Custom temp+rename | `write-file-atomic` (installed) | Handles edge cases: SIGINT during write, cross-device rename |
| Frontmatter parsing | Custom regex | `gray-matter` (installed) | Already used; handles YAML, TOML, JSON frontmatter variants |
| Copy directory recursively | Manual `fs.readdir` walk | `fs.cp(src, dst, { recursive: true })` | Node 20+ built-in, handles symlinks correctly |
| Toast notifications | Install Sonner/react-hot-toast | Custom Tailwind component (~30 lines) | UI-SPEC says custom; no external dependency justified for 3 toast variants |
| Conflict dialog | Install react-modal | shadcn Dialog via `@radix-ui/react-dialog` | Already used pattern in the project (button, card, input from radix) |

---

## Common Pitfalls

### Pitfall 1: Virtual Artifact Path Fragments

**What goes wrong:** Attempting `fs.readFile(artifact.absolutePath)` on a hook or MCP artifact throws because `absolutePath` is `settings.json#hookId`, not a real path. The `#` fragment is a synthetic ID, not a URL fragment or filesystem path.

**Why it happens:** Scanner synthesizes virtual artifacts to represent JSON entries. The absolutePath is a composite key, not a real file system path.

**How to avoid:** Before any filesystem operation, check if `absolutePath.includes('#')`. If true, block the operation. The promote/demote matrix in the section above formalizes this.

**Warning signs:** `ENOENT` errors on file operations with paths containing `#`.

### Pitfall 2: Cross-Device Move Failure

**What goes wrong:** `fs.rename(src, dest)` throws `EXDEV: cross-device link not permitted` when source and destination are on different filesystems/volumes (common with external drives or Docker volumes).

**Why it happens:** `rename` syscall is atomic only within the same filesystem.

**How to avoid:** Implement move as: `fs.cp(src, dest, { recursive: true })` then `fs.unlink(src)` (or `fs.rm(src, { recursive: true })` for directories). This is not atomic but is the safe cross-device fallback.

### Pitfall 3: headless-tree Selection vs Focus Conflation

**What goes wrong:** Treating the headless-tree "focused item" (keyboard cursor) as the "selected item" (shows detail panel). They are independent states. Arrow keys move focus, not selection. Click selects.

**Why it happens:** headless-tree maintains `focusedItem` (keyboard highlight) and `selectedItems` (explicitly selected) as separate state. `getContainerProps()` already handles arrow key focus movement.

**How to avoid:** Use `item.isSelected()` for detail panel display and selected row styling. Use `item.isFocused()` only for keyboard ring styling. On single-click: call `setSelectedItems([item.getId()])`. On Enter (via `onPrimaryAction`): if item is already selected, open in editor; else select it.

### Pitfall 4: Plugin Directory Copy vs File Copy

**What goes wrong:** Using `fs.copyFile(src, dest)` for a plugin artifact. Plugin `absolutePath` points to `plugin.json` inside `plugins/name/plugin.json`. The entire directory (`plugins/name/`) must be copied, not just `plugin.json`.

**How to avoid:** For `artifact.type === 'plugin'`, derive the plugin directory as `path.dirname(artifact.absolutePath)`. Use `fs.cp(pluginDir, destPluginDir, { recursive: true })`.

### Pitfall 5: Context Menu Positioning Near Viewport Edge

**What goes wrong:** Custom dropdown renders below the trigger, but trigger is near the bottom of viewport — menu clips off screen.

**Why it happens:** Naive `position: absolute; top: 100%` positioning.

**How to avoid:** On open, measure trigger's `getBoundingClientRect()`. If `bottom + menuHeight > window.innerHeight`, render above (flip). This is ~10 lines of positioning logic in the ContextMenu component. No library needed for this simple case.

### Pitfall 6: Cmd+C Conflict with Browser Default

**What goes wrong:** `keydown` handler on the tree container intercepts Cmd+C but the user has text selected in a different element — the native copy is blocked.

**How to avoid:** In the Cmd+C handler, check `if (document.activeElement)` is inside the tree container before intercepting. headless-tree's `getContainerProps()` includes `onKeyDown` — attach additional Cmd+C/V handlers to the same container div via a wrapper or merge the handlers.

---

## Code Examples

### POST /api/operations/open (server)

```typescript
// Source: open v11 README + scan.ts pattern
import open from 'open';

server.post('/api/operations/open', { schema: { body: z.object({ path: z.string() }) } },
  async (req) => {
    await open(req.body.path); // opens in default system app
    return { success: true };
  }
);
```

### POST /api/operations/open-folder (server)

```typescript
// Open directory in Finder/Explorer
await open(directoryPath); // on macOS, opens in Finder if path is a directory
```

### Conflict Check Pattern (server)

```typescript
async function checkConflict(destPath: string): Promise<boolean> {
  try { await fs.access(destPath); return true; }
  catch { return false; }
}
// Return { success: false, conflict: true } — let client decide to confirm
```

### Selection State in ArtifactTree (client)

```typescript
// Source: headless-tree/core v1.6.3 type defs
import { selectionFeature, hotkeysCoreFeature } from '@headless-tree/core';

const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [focusedId, setFocusedId] = useState<string | null>(null);

const tree = useTree<TreeNodeData>({
  // ... existing ...
  features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  state: { selectedItems: selectedIds, focusedItem: focusedId },
  setSelectedItems: setSelectedIds,
  setFocusedItem: setFocusedId,
  onPrimaryAction: (item) => {
    const data = item.getItemData();
    if (data.nodeKind === 'leaf') handleDoubleClick(data as Artifact);
  },
});

// Derive selected artifact for detail panel
const selectedArtifact = useMemo(() => {
  if (selectedIds.length !== 1) return null;
  const data = items[selectedIds[0]];
  return data?.nodeKind === 'leaf' ? data as Artifact : null;
}, [selectedIds, items]);
```

### Description Extraction (client, no API call needed)

```typescript
// Artifact.frontmatter is already populated by scanner — no file read needed
function getDescription(artifact: Artifact): string {
  if (artifact.frontmatter?.description) {
    return String(artifact.frontmatter.description);
  }
  // frontmatter.content is not stored — panel shows "No description available."
  // for artifacts with no description field
  return 'No description available.';
}
```

Note: The scanner does NOT store the non-frontmatter body content in the Artifact object. Only `frontmatter` is stored. For the fallback "first non-frontmatter paragraph" behavior decided in CONTEXT.md, the client would need to fetch the file content or add a new `/api/operations/describe` endpoint. The simpler approach: if no `frontmatter.description`, display "No description available." rather than adding an API round-trip. This is a planning decision — flagged as open question below.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `fs.copyFile` for all | `fs.cp(src, dst, { recursive: true })` (Node 16.7+) | One function handles files + directories |
| `open` v8 CommonJS | `open` v11 ESM-only | Import syntax: `import open from 'open'` |
| Manual temp+rename | `write-file-atomic` | Already established in this codebase |
| Radix ContextMenu component | Custom Tailwind dropdown | Decision from CONTEXT.md — no new shadcn component |

---

## Open Questions

1. **Fallback description source for SUMM-01**
   - What we know: `Artifact.frontmatter?.description` is available in tree data without an API call. CONTEXT.md says fallback is "first non-frontmatter paragraph."
   - What's unclear: The scanner does not store file body content in the Artifact object. Extracting the first paragraph requires either a new API endpoint (`GET /api/operations/describe?path=...`) or a client-side file read (not possible in browser).
   - Recommendation: Add a lightweight `GET /api/operations/describe` route that reads the file and returns `{ description: string | null }`. Only called on artifact selection when `frontmatter.description` is absent. This is a single file read, fast for any Claude artifact.

2. **Cross-device move error handling**
   - What we know: `fs.rename` fails with `EXDEV` on cross-device moves. `fs.cp + fs.unlink` is the fallback.
   - What's unclear: Whether users commonly have global `~/.claude` and project dirs on different volumes.
   - Recommendation: Always use `fs.cp + fs.unlink` for move operations to avoid the EXDEV edge case. Slight overhead but correct behavior.

3. **MCP config disabled state in context menu**
   - What we know: Promote/demote is blocked for MCP configs and hooks.
   - What's unclear: Whether to show the disabled menu items at all, or simply omit them.
   - Recommendation: Show disabled items with a tooltip. This educates users why the action is unavailable rather than silently hiding it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest.config.ts (inferred from package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run tests/operations.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | POST /api/operations/open returns 200 | unit (server inject) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-02 | Context menu renders for leaf artifacts | unit (React Testing Library) | `npx vitest run tests/ContextMenu.test.tsx` | Wave 0 |
| OPS-03 | Arrow key navigation moves focus in tree | unit (React Testing Library) | `npx vitest run tests/ArtifactTree.test.tsx` | Extend existing |
| OPS-04 | POST /api/operations/copy copies file to destination | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-05 | POST /api/operations/move removes source after copy | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-06 | POST /api/operations/promote copies to global scope dir | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-07 | POST /api/operations/demote copies to project scope dir | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-08 | Conflict returns `{ conflict: true }` when overwrite=false | unit (server inject) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| OPS-09 | Move uses cp+unlink not rename (no EXDEV risk) | unit (spy on fs.cp/fs.rename) | `npx vitest run tests/operations.test.ts` | Wave 0 |
| SUMM-01 | Detail panel shows artifact name/type/description | unit (React Testing Library) | `npx vitest run tests/ArtifactDetailPanel.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/operations.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/operations.test.ts` — covers OPS-01 through OPS-09 (server route tests using Fastify inject + temp dir fixtures)
- [ ] `tests/ContextMenu.test.tsx` — covers OPS-02 (context menu rendering + menu items per node type)
- [ ] `tests/ArtifactDetailPanel.test.tsx` — covers SUMM-01 (panel shows name, type, description)
- [ ] Extend `tests/ArtifactTree.test.tsx` — add selection state and keyboard navigation tests for OPS-03

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@headless-tree/core/dist/index.d.ts` — selectionFeature, hotkeysCoreFeature, onPrimaryAction API verified directly from installed package
- `package.json` (project root) — confirmed installed dependencies: open@11.0.0, write-file-atomic@7.0.1, gray-matter@4.0.3
- `src/scanner/classify.ts` — confirmed Artifact.frontmatter population, virtual artifact absolutePath pattern (`#` fragments for hooks/MCP)
- `src/server/routes/scan.ts` — confirmed Fastify withTypeProvider pattern for new routes
- `src/server/index.ts` — confirmed createServer pattern, ZodTypeProvider setup
- Node.js 20 docs — `fs.cp` (recursive), `fs.rename` (EXDEV risk), `fs.access` (conflict detection)

### Secondary (MEDIUM confidence)

- `open` v11.0.0 installed package — `open(path)` invokes OS default app, directory path opens Finder on macOS. Verified by inspecting installed package source.

### Tertiary (LOW confidence)

- Cross-device `fs.rename` EXDEV behavior — based on known POSIX syscall semantics and training knowledge. Not tested against actual cross-volume scenario in this environment.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified from installed node_modules and package.json
- Architecture: HIGH — follows established scan.ts pattern; headless-tree API verified from type defs
- Promote/demote safety matrix: HIGH for file-based artifacts; MEDIUM for virtual artifacts (hook/MCP behavior inferred from absolutePath pattern in classify.ts)
- Pitfalls: HIGH — virtual artifact pitfall verified from classify.ts source; cross-device EXDEV is LOW (training-based)

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable stack, no fast-moving dependencies)
