# Pitfalls Research

**Domain:** Local web app for managing Claude Code artifacts (file explorer + copy/move across scopes)
**Researched:** 2026-03-28
**Confidence:** HIGH (most pitfalls grounded in official docs, verified behavior, or known Node.js/npm failure modes)

---

## Critical Pitfalls

### Pitfall 1: Corrupting settings.json During Write

**What goes wrong:**
A copy/move/promote operation writes to `~/.claude/settings.json` or `.claude/settings.json` while a Claude Code session has the file open. The write is not atomic -- the file gets truncated to 0 bytes, then partially written, then Claude Code reads it mid-write and either crashes or silently loses all MCP server config, permissions, and plugin state.

**Why it happens:**
`fs.writeFile` in Node.js is not atomic. It opens the file, truncates it, then writes. If any failure occurs -- power, SIGKILL, concurrent write -- you get a partially written or empty JSON file. Developers test the happy path and never see this. Claude Code users tend to run Claude continuously in the background while using other tools on top of it.

**How to avoid:**
- Write to a temp file first (`settings.json.tmp`), then `fs.rename()` to the target. `rename()` is atomic on POSIX (same filesystem).
- Use `write-file-atomic` (npm package, maintained by npm themselves) which does exactly this.
- Before any write, read the current file and validate it parses as JSON. Store it as a rollback copy.
- Never write directly to settings files without the temp-then-rename pattern.

**Warning signs:**
- Any code path that calls `fs.writeFile(settingsPath, ...)` directly (not via atomic write).
- Tests that only test successful writes, never interrupted ones.
- No backup/rollback logic before settings mutations.

**Phase to address:** Core file operations phase (before any copy/move UI is built). This is the foundation.

---

### Pitfall 2: Treating Different Artifact Types as the Same "File"

**What goes wrong:**
The app treats all artifacts as generic files and allows copy/move without understanding format. A `settings.json` move fails silently because `mcpServers` keys use absolute paths and `${CLAUDE_PLUGIN_ROOT}` variables that point to the source machine's filesystem. A hooks config moves fine but the referenced shell scripts don't move with it. A skill's `SKILL.md` copies without its `scripts/` subdirectory.

**Why it happens:**
Artifact types in Claude Code have different structures and different referencing patterns (confirmed from official docs):
- Skills: directory with `SKILL.md` plus optional `scripts/` and `reference.md`
- Agents: single `.md` file with YAML frontmatter (name, model, maxTurns, etc.)
- Commands: single `.md` file (simpler than skills)
- Hooks: `hooks.json` with paths referencing scripts that live alongside it
- MCP servers: entries in `settings.json` or `.mcp.json` with `command`, `args`, `env` fields that contain absolute paths
- CLAUDE.md: flat markdown, safe to copy as-is

The temptation is to build one "copy file" function and call it done.

**How to avoid:**
- Define an artifact type registry: each type declares its "copy unit" (is it a file? a directory? a JSON key within a larger file?).
- For each type, define what a valid copy looks like (e.g., skills copy the entire directory, not just `SKILL.md`).
- MCP server entries: on copy/promote, warn the user that `command` paths may need updating.
- Hooks: copy the referenced scripts alongside the hooks.json, or warn when referenced scripts are outside the artifact directory.
- Validate artifact integrity after copy (parse the output, check for dangling references).

**Warning signs:**
- A single generic "copy file" utility being called for all artifact types.
- No type-specific validation after copy operations.
- No user-facing warning when MCP entries contain absolute paths.

**Phase to address:** Artifact parsing/type system phase, before copy/move operations are built.

---

### Pitfall 3: Non-Atomic Move Operations Causing Data Loss

**What goes wrong:**
A "move" artifact operation does: copy to destination, delete from source. If the delete succeeds but the copy was corrupt, or the app crashes between the two steps, the artifact is gone. For a user's `~/.claude/settings.json`, this is catastrophic -- all their MCP servers, permissions, and plugin config is silently deleted.

**Why it happens:**
Move across filesystems (or within a filesystem but implemented naively) is inherently two operations. Developers write the happy path and skip failure handling between steps.

**How to avoid:**
- Order operations: write destination first, verify it parses/reads correctly, then delete source. Never delete before confirming destination is valid.
- For moves within the same volume, use `fs.rename()` which is atomic on POSIX.
- For cross-volume moves (e.g., global to project on a different mount), explicitly: write temp, verify, rename, then delete source only after rename succeeds.
- Build a pre-operation backup: before any destructive operation on a settings file, snapshot it to a temp location. Offer a "last backup" restore in the UI.

**Warning signs:**
- "Move" implemented as `copy() + delete()` without a verify step between them.
- No rollback path for partial failures.
- `fs.unlink(source)` called before confirming destination integrity.

**Phase to address:** File operations phase. Treat move as "copy + verify + delete", never as a single step.

---

### Pitfall 4: Path Handling Breaks on Windows (and Partially on Linux)

**What goes wrong:**
The app works perfectly on macOS (primary target) but produces broken paths on Windows because:
- Hardcoded `/` separators instead of `path.sep`
- Tilde expansion (`~/.claude`) done manually instead of `os.homedir()`
- `path.join()` skipped in favor of string concatenation

On Windows: `~` is not expanded by Node.js at all (confirmed: Node.js has no built-in tilde expansion). `process.env.HOME` doesn't exist on Windows; it's `process.env.USERPROFILE` or `process.env.HOMEPATH`. `os.homedir()` handles all platforms correctly.

**Why it happens:**
Developer tests on macOS only. String paths "look right" during development. The issue only appears on Windows where `\` is the separator and `~` is not a special shell character.

**How to avoid:**
- Always use `os.homedir()` for the home directory, never `process.env.HOME` or `~`.
- Always use `path.join()` or `path.resolve()`, never string concatenation for paths.
- When displaying paths in the UI, use `path.normalize()`.
- When reading config files that may contain user-typed `~` paths (e.g., in MCP server config), expand tildes explicitly: `p.replace(/^~/, os.homedir())`.
- Test on Windows CI early -- don't wait for user bug reports.

**Warning signs:**
- Any `~/` string literal in path code.
- `process.env.HOME` used without fallback.
- `/` used as a path separator in string concatenation.

**Phase to address:** Project scaffolding phase. Set up path utilities as shared helpers from day one. Don't let path string manipulation spread through the codebase.

---

### Pitfall 5: npx Startup Fails Silently or Leaves Orphan Processes

**What goes wrong:**
The app starts a local Express server on a fixed port (say 3000). User runs `npx claude-directory-tree` a second time -- port 3000 is in use, the new process fails with `EADDRINUSE`, no browser opens, user sees nothing or a cryptic error. The old process is still running (user forgot about it). Alternatively: the app opens a browser tab and the user closes it, but the Node.js process keeps running, consuming resources indefinitely.

Also: on some systems, `localhost` resolves to IPv6 (`::1`) before IPv4 (`127.0.0.1`), causing a timeout before fallback. This makes startup feel "slow" even when everything is working.

**Why it happens:**
Fixed ports are the path of least resistance. Developers test with a single instance. Orphan process management requires explicit signal handling.

**How to avoid:**
- Use dynamic port allocation: try port 3000, if taken increment until a free port is found. The `get-port` npm package handles this cleanly.
- Detect if an existing instance is running (check a lock file with the PID and port) and either open the browser to the existing instance, or offer to kill the old one.
- Register `process.on('SIGINT')` and `process.on('SIGTERM')` to clean up the lock file and server.
- Bind to `127.0.0.1` explicitly, not `localhost`, to avoid the IPv4/IPv6 resolution delay.
- Print the URL clearly when the server starts: `Listening on http://127.0.0.1:3842` so users know what's running.

**Warning signs:**
- Hardcoded `port: 3000` with no fallback.
- No lock file or process detection logic.
- Server binding to `localhost` instead of `127.0.0.1`.
- No SIGINT/SIGTERM handling.

**Phase to address:** npx distribution / CLI scaffolding phase.

---

### Pitfall 6: npx Caching Serves Stale Version

**What goes wrong:**
User runs `npx claude-directory-tree` and gets a version from 3 months ago. npm's npx caches packages and does not always re-fetch on subsequent runs. Users report bugs that were already fixed. `npx package@latest` is the workaround, but users don't know to use it.

**Why it happens:**
npm introduced aggressive caching for npx in npm 7+. There is a confirmed bug (npm/cli#5262) where `npx package@latest` still executes a cached older version in some cases.

**How to avoid:**
- Document in the README and `--help` output: "If you're seeing stale behavior, run `npx claude-directory-tree@latest`."
- Consider adding a startup check: on launch, fetch the latest version from the npm registry (a simple `npm show claude-directory-tree version` equivalent) and warn the user if they're not on latest.
- Pin major versions in docs: `npx claude-directory-tree@1` is more predictable than unpinned.

**Warning signs:**
- No version displayed at startup.
- No documentation about cache-busting.
- Users reporting "I already fixed that bug" issues.

**Phase to address:** npx distribution phase. Include version display in first milestone.

---

### Pitfall 7: Settings.json Merge Conflict When Promoting/Demoting MCP Servers

**What goes wrong:**
User promotes a project-local MCP server entry to global. The app reads `~/.claude/settings.json`, merges in the new entry, and writes it back. But `settings.json` also contains `permissions`, `pluginConfigs`, `enabledPlugins`, and potentially scope-specific fields. A naive merge that only understands `mcpServers` silently drops or corrupts other settings.

Also: Claude Code has multiple settings files per scope (`settings.json`, `settings.local.json`, `.mcp.json`). The app needs to know which file "owns" which artifact, or it will write MCP configs to the wrong file and Claude Code won't pick them up.

**Why it happens:**
Developers see JSON and implement a simple `Object.assign(existing, newEntry)`. The full settings schema (permissions, pluginConfigs, hooks, enabledPlugins, env) is not obvious from looking at a single settings.json -- it varies by what the user has configured.

**How to avoid:**
- Treat settings files as append-only for additions: read the file, surgically insert/remove only the specific key being operated on, write back. Don't merge whole objects.
- Understand the file hierarchy: `~/.claude/settings.json` (user scope), `.claude/settings.json` (project scope), `.claude/settings.local.json` (local scope, gitignored), `.mcp.json` (project MCP). Each is a different scope with different semantics.
- Before writing, re-read the file (in case another process changed it between read and write -- Claude Code itself may have written to it).
- Log every settings file mutation (what was added/removed) for debugging.

**Warning signs:**
- `Object.assign()` or spread used on entire settings file objects.
- App only knows about one settings file per project, not the full scope hierarchy.
- No read-before-write safety check.

**Phase to address:** Artifact type system + file operations phase, before any promote/demote UI.

---

### Pitfall 8: Directory Scanning Is Too Broad or Too Slow

**What goes wrong:**
The app is asked to scan a parent directory for projects. User points it at `~/Documents` which contains 200+ directories, several of which have deeply nested `.claude/` folders or symlinks that create infinite loops. The scan takes 30+ seconds, the UI hangs, and the app feels broken.

Or the opposite: the scan only checks the immediate children of the target directory and misses `.claude/` folders nested 2-3 levels deep (monorepos, workspace setups).

**Why it happens:**
Recursive directory walking without depth limits or cycle detection. No progress feedback. Synchronous fs calls blocking the event loop.

**How to avoid:**
- Scan asynchronously (never block the event loop with `readdirSync` on large directories).
- Set a max depth (2-3 levels is enough for most project structures; expose it as a config).
- Skip common non-project directories: `node_modules`, `.git`, `dist`, `build`, `vendor`.
- Detect and break symlink cycles by tracking visited inode numbers.
- Show a loading state in the UI during scan; don't wait for completion to render anything.
- Cache scan results and only re-scan on explicit refresh.

**Warning signs:**
- Synchronous `readdirSync` / `statSync` in the scan path.
- No depth limit on recursive scanning.
- No skip list for `node_modules`.
- No loading state in the UI.

**Phase to address:** Project discovery / tree view phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `fs.writeFile` directly to settings files | Simple code | Config corruption on crash or concurrent access | Never -- always use atomic write |
| Hardcode port 3000 | Zero complexity | Port conflicts on second launch, bad UX | MVP only, replace before first public release |
| Treat all artifacts as flat files | Simple copy logic | Silent data loss for skills (need directory copy), broken MCP paths | Never -- type awareness must be in v1 |
| Read `process.env.HOME` for home dir | Familiar, works on macOS/Linux | Breaks on Windows | Never -- use `os.homedir()` from day one |
| Recursive scan with no depth limit | Finds everything | Hangs on large directory trees, symlink loops | Never in production |
| Overwrite full settings.json on every change | Simple merge logic | Silently drops settings written by Claude Code between read and write | Never -- surgical key-level edits only |
| String concatenation for paths | Looks readable | Breaks on Windows, breaks with spaces in paths | Never -- use `path.join()` always |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code `settings.json` | Treating it as a simple key-value store | It has nested scope semantics (`mcpServers`, `permissions`, `pluginConfigs`, `enabledPlugins`) -- only touch the keys you own |
| Claude Code `.mcp.json` | Assuming MCP config only lives in `settings.json` | MCP servers can be in `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, or `.mcp.json` -- you must scan all four |
| Skills directory | Copying only `SKILL.md` | Skills are directories (`skills/<name>/SKILL.md` + optional `scripts/`, `reference.md`) -- copy the whole directory |
| Hooks `hooks.json` | Moving the JSON without the referenced scripts | Hook commands reference scripts at relative paths from the plugin/hooks directory -- scripts must move with the config |
| Agent `.md` frontmatter | Ignoring YAML frontmatter during copy | Agents have structured frontmatter (model, maxTurns, tools, disallowedTools) that must remain valid after copy |
| System editor open | `child_process.exec('open ' + path)` | Path must be quoted; use `shell-quote` or `execa` to prevent command injection if path contains spaces or special chars |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous directory scanning | UI freezes during project discovery | Use `fs.promises.readdir()` throughout; never `readdirSync` in server request handlers | ~20+ directories |
| Rendering all tree nodes without virtualization | Scroll lag, 1-2 second re-renders | Use react-window or react-arborist for tree virtualization | ~500+ nodes visible (15 projects x many artifacts) |
| Re-reading all settings files on every API request | Slow response for every tree interaction | Cache settings file contents; invalidate only on explicit refresh or file-watcher event | ~10+ projects |
| No skip list in recursive scan | Scan takes 30s+ on repos with node_modules | Skip `node_modules`, `.git`, `dist`, `build`, `__pycache__` by default | Any project with node_modules at scan root |
| Parsing every file's content to generate summaries on startup | Startup takes 5-10+ seconds | Generate summaries lazily (on hover/expand), not during initial scan | ~50+ artifacts |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Serving the API on `0.0.0.0` instead of `127.0.0.1` | Any machine on the local network can read the user's Claude config files and move/delete artifacts | Always bind to `127.0.0.1` explicitly |
| No CSRF protection on mutation endpoints (copy/move/delete) | A malicious website open in another tab can make POST requests to `localhost:3000/api/move` and corrupt the user's Claude setup | Use a secret token in request headers; check `Origin` header on mutations |
| Path traversal in API endpoints | `POST /api/read?path=../../.ssh/id_rsa` -- attacker (or bug) reads arbitrary files | Validate all incoming paths are within allowed roots (`~/.claude/` and registered project `.claude/` dirs) |
| `shell.exec()` with unquoted file paths | A project directory named `; rm -rf ~` causes command injection when opening in editor | Use `execa` with argument arrays, never string interpolation into shell commands |
| Serving static assets from user's home directory | `GET /files/../../.env` reads environment files | Serve only the frontend bundle from a known safe path; keep file API and static serving completely separate |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No confirmation before destructive operations (move = delete from source) | User accidentally moves a global MCP server config to a project and breaks all other projects | Require explicit confirmation for move/promote/demote; show what will change |
| No undo for copy/move operations | User makes a mistake and has no recovery path | Implement undo as "reverse the operation" (move back), not full file-system undo |
| Showing raw file paths in tree labels | Power users appreciate it, but paths are long and noisy | Show artifact name, show full path on hover or in a detail panel |
| Ambiguous artifact names in tree (two projects both have a skill called "deploy") | User copies the wrong one | Scope badges on each item: show project name alongside artifact name |
| Silent success on copy operations | User isn't sure if the operation worked | Show a brief toast/notification: "Copied `deploy` to Project X" with an undo action |
| Opening system editor fails without feedback | User clicks "Open in editor", nothing happens (editor not in PATH, or `EDITOR` env var not set) | Detect the platform default editor; fall back to a sensible default (`code`, `vim`, `nano`); show a clear error if none works |

---

## "Looks Done But Isn't" Checklist

- [ ] **Copy operation:** Only copied `SKILL.md`, not the full skill directory with `scripts/` -- verify by checking if skill has scripts and confirming they are present at destination.
- [ ] **MCP server promote:** Copied the settings.json key but the `command` path still points to the old project directory -- verify by checking if command path contains the source project root.
- [ ] **Move operation:** Deleted the source before verifying destination integrity -- verify by parsing/reading destination file successfully before issuing delete.
- [ ] **Settings write:** Wrote settings.json and silently dropped the `permissions` or `pluginConfigs` keys -- verify by reading back the written file and confirming all original top-level keys are present.
- [ ] **Project scan:** Found `.claude/` folders but missed projects where the user registered them manually (the manual registry must persist across restarts) -- verify registration survives app restart.
- [ ] **Cross-platform:** App works on macOS but paths break on Windows -- verify on Windows CI with paths containing spaces and using `%USERPROFILE%`.
- [ ] **npx distribution:** `bin` file missing execute bit -- verify with `ls -la node_modules/.bin/claude-directory-tree` showing `x` permissions.
- [ ] **Port conflict:** Second launch of app silently fails -- verify by running two instances and confirming the second either reuses the first or finds a new port.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| settings.json corrupted to invalid JSON | HIGH | Restore from the backup snapshot taken before the write; expose a "restore last backup" button in the app's error state |
| Artifact moved to wrong scope | LOW | Implement move-back as a first-class operation; the same move logic works in reverse |
| MCP server entry duplicated across scopes | LOW | Show duplicate detection in the tree view (yellow warning icon); provide a "remove duplicate" action |
| Orphan server process consuming port | LOW | On launch, detect existing process via lock file and offer "kill old instance and start fresh" |
| Scan found wrong projects (overly broad root) | LOW | Expose the project list as editable; allow removing false positives and manually adding missed projects |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Atomic writes / settings corruption | Phase 1: Core file operations | Write a test that simulates mid-write crash; confirm rollback leaves original intact |
| Artifact type awareness | Phase 1: Artifact type registry | Each artifact type has a defined "copy unit" test |
| Non-atomic move (data loss) | Phase 1: Core file operations | Test move where copy succeeds but delete target was originally invalid |
| Path handling (cross-platform) | Phase 1: Project scaffolding | All path utilities have unit tests with Windows-style paths as inputs |
| npx port conflicts + orphan processes | Phase 2: npx distribution | Test: launch twice; confirm second instance detects first |
| npx stale cache | Phase 2: npx distribution | Document `@latest` flag; add version display at startup |
| Settings.json surgical merge | Phase 2: Artifact operations | Test: add MCP entry; verify no other settings keys were modified |
| Directory scan performance + safety | Phase 2: Project discovery | Benchmark scan on a directory with `node_modules`; confirm depth limit works |
| CSRF / localhost binding | Phase 3: Security hardening | Confirm server binds to `127.0.0.1`; test CSRF token on mutation endpoints |
| UX: confirmation before destructive ops | Phase 3: UI polish | User test: verify no accidental moves occur without confirmation dialog |

---

## Sources

- Claude Code plugins reference (official): https://code.claude.com/docs/en/plugins-reference -- artifact types, file locations, settings scope hierarchy (HIGH confidence)
- npm/write-file-atomic: https://github.com/npm/write-file-atomic -- atomic write pattern (HIGH confidence)
- npx stale version bug: https://github.com/npm/cli/issues/5262 (MEDIUM confidence)
- Node.js tilde expansion issue: https://github.com/nodejs/node/issues/684 -- confirmed Node.js does not expand `~` (HIGH confidence)
- cross-platform-node-guide: https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/file_paths.md (HIGH confidence)
- react-arborist for virtualized tree view: https://github.com/Lodin/react-vtree (MEDIUM confidence)
- MUI TreeView performance issue on large datasets: https://github.com/mui/mui-x/issues/10300 (MEDIUM confidence)
- npx confusion / unclaimed package names: https://www.aikido.dev/blog/npx-confusion-unclaimed-package-names (MEDIUM confidence)

---

*Pitfalls research for: Claude Directory Tree (local web app, Claude Code artifact manager)*
*Researched: 2026-03-28*
