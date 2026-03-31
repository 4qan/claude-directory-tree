# Phase 4: Plugin Distribution - Research

**Researched:** 2026-03-31
**Domain:** Claude Code plugin system, npm package distribution
**Confidence:** HIGH

## Summary

This phase packages the fully-built app for two distribution channels: a Claude Code plugin (invoked as `/claude-tree` inside Claude Code sessions) and a standard npm package (invoked as `npx claude-directory-tree` or the installed binary). All application logic is already built. This phase is purely structural and packaging work.

The Claude Code plugin system is well-documented and stable as of Claude Code v1.0.33+. The key finding is that plugin commands (skills/commands in Claude Code terminology) are prompt-based: they send a markdown prompt to Claude, which then uses the Bash tool to execute shell commands. For this app, the command file must instruct Claude to run `npx claude-directory-tree` (or the installed binary). There is no direct shell-invocation mechanism from a command file itself. The appropriate pattern is a one-line command `.md` file that tells Claude to run the CLI.

The npm distribution path is straightforward: the package is unscoped, already has a correct `bin` field, and needs a `files` field added to `package.json` plus a `prepublishOnly` script. No scope or registry changes needed.

**Primary recommendation:** Ship the plugin as a subdirectory of the repo with a `marketplace.json` at the repo root. Users install via `/plugin marketplace add owner/repo` then `/plugin install claude-tree@marketplace-name`. The npm package publishes with `npm publish` after adding `files` field and `prepublishOnly` script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Plugin command: `/claude-tree` (explicit, no collision risk)
- Secondary command: `/claude-tree-add` (registers a project without opening UI, maps to existing `--add` flag)
- npm binary name stays `claude-directory-tree`
- Both plugin and standalone use the same parent-directory scan logic
- Default: scan from cwd (standalone) or project root (plugin), always include registered projects + global scope
- Optional directory argument overrides the default in both contexts
- Universal view builds organically as users register projects via `--add` or `/claude-tree-add`
- No scanning from `~` (performance concern)
- Unscoped package: `claude-directory-tree`
- Version: `0.1.0`
- README with text + screenshots/GIFs of the tree UI, context menu, detail panel
- GitHub public repo, MIT license (already in package.json)

### Claude's Discretion
- Plugin.json structure and command wiring (informed by research)
- npm publish workflow (prepublish scripts, .npmignore, files field, CI)
- Build output structure for distribution
- README content and screenshot selection
- Contributing guide structure

### Deferred Ideas (OUT OF SCOPE)
None. Discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| npm CLI | 11.x (current) | Publishing to npm registry | Official tool |
| tsup | 8.5.x (already installed) | Build the CLI and server bundle | Already used |
| vite | 8.x (already installed) | Build the client SPA | Already used |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `npm pack` | Dry-run to preview what ships | Before every first publish |
| `npm publish --dry-run` | Full dry-run including registry simulation | Final check before real publish |
| `claude plugin validate` | Validates plugin.json and component files | After writing plugin structure |
| `claude --plugin-dir` | Local dev/test of plugin without installing | During plugin development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub repo as marketplace | Anthropic official marketplace submission | Official requires review; GitHub gives immediate control |
| `files` field in package.json | `.npmignore` | `files` allowlist is safer; `.npmignore` is a blocklist and can leak files |

**Installation (for users, not this project):**
```bash
# Plugin install (after marketplace is set up)
/plugin marketplace add furqantariq/claude-directory-tree
/plugin install claude-tree@claude-directory-tree

# npx (zero install)
npx claude-directory-tree
```

---

## Architecture Patterns

### Plugin Structure
The plugin lives as a subdirectory of the existing repo (e.g., `plugin/`). The marketplace catalog lives at the repo root in `.claude-plugin/marketplace.json`. When users add the marketplace via GitHub, Claude Code clones the full repo and resolves relative paths correctly.

```
claude-directory-tree/          ← existing repo root
├── .claude-plugin/
│   └── marketplace.json        ← marketplace catalog (NEW)
├── plugin/                     ← plugin directory (NEW)
│   ├── .claude-plugin/
│   │   └── plugin.json         ← plugin manifest (NEW)
│   └── commands/
│       ├── claude-tree.md      ← /claude-tree command (NEW)
│       └── claude-tree-add.md  ← /claude-tree-add command (NEW)
├── dist/                       ← existing build output
├── src/                        ← existing source
├── package.json                ← add `files` field + `prepublishOnly`
└── README.md                   ← expand with screenshots + install docs
```

**Critical structural rule:** `commands/` must be at plugin root, NOT inside `.claude-plugin/`. Only `plugin.json` goes in `.claude-plugin/`.

**Namespacing note:** Plugin commands are namespaced by the plugin `name` field. If `plugin.json` has `"name": "claude-tree"`, the command file `commands/claude-tree.md` becomes `/claude-tree:claude-tree` — which is ugly. To get `/claude-tree` as the command name, set `"name"` in `plugin.json` to something else (e.g., `"claude-directory-tree"`) and name the command file `claude-tree.md`, resulting in `/claude-directory-tree:claude-tree`. OR use a single-component name by relying on the fact that commands in the `commands/` directory of a plugin are skills with the plugin namespace prefix.

**Resolution:** The command will be `/claude-directory-tree:claude-tree` and `/claude-directory-tree:claude-tree-add`. This is acceptable and unambiguous. Users can alias these in their own `.claude/` if desired.

Alternatively: set plugin name to `claude-tree` in `plugin.json` and name the files `launch.md` and `add.md` — producing `/claude-tree:launch` and `/claude-tree:add`. This is cleaner UX.

### How Plugin Commands Work

Commands in Claude Code plugins are **prompt files**, not shell scripts. When a user runs `/claude-tree:launch`, Claude Code sends the contents of `commands/launch.md` as a prompt to Claude, which then executes it using available tools (primarily Bash).

The command file should instruct Claude to run the CLI binary. Example:

```markdown
---
description: Open Claude Directory Tree in the browser
---

Run this command in the terminal to launch the Claude Directory Tree UI:

```bash
npx claude-directory-tree
```

This will scan the current project directory, start a local server, and open the browser automatically.
```

Claude will use its Bash tool to execute `npx claude-directory-tree`. The `$ARGUMENTS` placeholder can pass an optional directory path.

### npm Package Distribution

The package is already structured correctly. Three changes needed:

1. Add `files` field to `package.json` (allowlist what ships)
2. Add `prepublishOnly` script (run build before publish)
3. Ensure `dist/` is not in `.gitignore` (it should NOT be committed, but npm publish needs it built fresh)

**Correct `files` field:**
```json
"files": [
  "dist/",
  "README.md",
  "LICENSE"
]
```

The `plugin/` directory should NOT be in `files` — it's for Claude Code plugin installation (git-based), not npm consumers.

**`prepublishOnly` script:**
```json
"prepublishOnly": "npm run build"
```

This runs `build:server` (tsup) then `build:client` (vite) automatically before publish.

### `dist/` and `.gitignore`

Standard practice: `dist/` IS in `.gitignore` (not committed to git). `npm publish` builds it fresh via `prepublishOnly`. The `files` field then includes `dist/` in the published tarball even though it's gitignored. This is correct behavior — npm's `files` field overrides `.gitignore`.

### Anti-Patterns to Avoid
- **Putting `commands/` inside `.claude-plugin/`:** plugin will load but commands won't be found
- **Using `.npmignore` as blocklist instead of `files` allowlist:** risk of accidentally shipping `src/`, `tests/`, `node_modules/` if blocklist misses something
- **Not running `npm pack` before first publish:** can't see what actually ships
- **Not bumping `plugin.json` version before distributing updates:** existing users won't get updates due to caching

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin install flow | Custom install scripts | Claude Code's `/plugin install` system | Already handles caching, scopes, updates |
| npm publish dry run | Manual file inspection | `npm pack` + `npm publish --dry-run` | Shows exact tarball contents |
| Plugin validation | Manual JSON inspection | `claude plugin validate .` | Catches schema errors and structure mistakes |
| Command invocation | MCP server or hooks | Simple command `.md` file telling Claude to run the CLI | Simplest mechanism that works |

---

## Common Pitfalls

### Pitfall 1: Plugin name collides with command name, producing ugly namespaced paths
**What goes wrong:** Plugin named `claude-tree` with command file `claude-tree.md` produces `/claude-tree:claude-tree`.
**Why it happens:** Plugin name is the namespace, filename is the command name — both segments appear.
**How to avoid:** Choose names deliberately. Use plugin name `claude-tree` and command file `launch.md` to get `/claude-tree:launch`, or plugin name `claude-directory-tree` and file `claude-tree.md` to get `/claude-directory-tree:claude-tree`.

### Pitfall 2: `dist/` ships nothing because `.gitignore` excluded it
**What goes wrong:** `npm pack` produces an empty or near-empty tarball.
**Why it happens:** Developer assumes gitignored = excluded from npm. Actually, `npm publish` runs `prepublishOnly` first, and the `files` field explicitly includes `dist/` regardless of `.gitignore`.
**How to avoid:** Always run `npm pack` and inspect the tarball contents before first publish: `tar -tf claude-directory-tree-0.1.0.tgz`.

### Pitfall 3: `files` field missing, shipping everything
**What goes wrong:** Published package includes `src/`, `tests/`, `node_modules/` symlinks, etc.
**Why it happens:** Without `files`, npm ships everything not in `.npmignore` or `.gitignore`.
**How to avoid:** Add `files` allowlist first. Run `npm pack` to verify.

### Pitfall 4: Plugin version not bumped before distributing update
**What goes wrong:** Users who already installed the plugin don't receive updates.
**Why it happens:** Claude Code uses the version field to detect whether to update cached plugin.
**How to avoid:** Bump `version` in `plugin.json` with every meaningful change.

### Pitfall 5: `plugin/` directory path traversal issue
**What goes wrong:** After user installs plugin, hooks or scripts reference files outside the plugin directory.
**Why it happens:** Installed plugins are copied to `~/.claude/plugins/cache/`, so relative paths like `../../dist/cli.js` break.
**How to avoid:** The command files are pure markdown prompts — they just tell Claude to run `npx claude-directory-tree`, so there's no path dependency on the installed npm package. This is fine.

### Pitfall 6: Marketplace relative paths fail if users add via URL
**What goes wrong:** Plugin entries with `"source": "./plugin"` fail if user adds marketplace via direct URL to `marketplace.json`.
**Why it happens:** URL-based marketplace download only fetches the JSON file, not the plugin directory.
**How to avoid:** Tell users to add via GitHub (`/plugin marketplace add furqantariq/claude-directory-tree`), not via a raw URL. Document this explicitly in README.

---

## Code Examples

### plugin.json (plugin manifest)
```json
{
  "name": "claude-tree",
  "version": "0.1.0",
  "description": "Visual explorer for all Claude Code artifacts across projects and scopes",
  "author": {
    "name": "Furqan Tariq",
    "url": "https://github.com/furqantariq"
  },
  "homepage": "https://github.com/furqantariq/claude-directory-tree",
  "repository": "https://github.com/furqantariq/claude-directory-tree",
  "license": "MIT",
  "keywords": ["claude", "artifacts", "tree", "explorer"]
}
```

### marketplace.json (at repo root in `.claude-plugin/`)
```json
{
  "name": "claude-directory-tree",
  "owner": {
    "name": "Furqan Tariq"
  },
  "plugins": [
    {
      "name": "claude-tree",
      "source": "./plugin",
      "description": "Visual explorer for all Claude Code artifacts across projects and scopes",
      "version": "0.1.0",
      "homepage": "https://github.com/furqantariq/claude-directory-tree"
    }
  ]
}
```

### commands/launch.md (the /claude-tree:launch command)
```markdown
---
description: Launch Claude Directory Tree - visual explorer for Claude artifacts
---

Run the following command to launch the Claude Directory Tree UI:

```bash
npx claude-directory-tree $ARGUMENTS
```

This opens a local web app that shows all your Claude artifacts (skills, agents, commands, plugins, hooks, CLAUDE.md files) across all projects in a visual tree.
```

### commands/add.md (the /claude-tree:add command)
```markdown
---
description: Register a project with Claude Directory Tree without opening the UI
---

Run the following command to register the current project (or a specified path) with Claude Directory Tree:

```bash
npx claude-directory-tree --add $ARGUMENTS
```

If no path is specified, registers the current directory. The project will appear in the tree next time you launch Claude Directory Tree.
```

### package.json additions
```json
{
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

### Verify tarball before publishing
```bash
npm pack
tar -tf claude-directory-tree-0.1.0.tgz
# Should show: dist/cli.js, dist/server/..., dist/server/client/..., README.md, LICENSE, package.json
```

### Publish workflow
```bash
npm login                           # one-time, prompts for npm credentials
npm run build                       # already runs via prepublishOnly, but verify manually
npm pack                            # inspect tarball
npm publish                         # publishes to registry
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Code had no plugin system | Full plugin system with marketplace, scopes, install CLI | ~late 2024 | Commands are now prompt-based, not direct shell execution |
| Commands as simple prompts | Skills (`SKILL.md`) in `skills/` directory, commands in `commands/` | 2025 | `skills/` is newer; `commands/` still works and is simpler for this use case |
| Single marketplace | Multiple marketplaces, scopes (user/project/local) | 2025 | Users can add your GitHub repo as a marketplace |

**Key currency note:** Plugin system requires Claude Code >= 1.0.33. The `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` env vars, `SessionStart` hook for dependency install, and npm plugin source are all current features verified from official docs.

---

## Open Questions

1. **Exact command namespace UX**
   - What we know: Plugin name `claude-tree` + command file `launch.md` = `/claude-tree:launch`
   - What's unclear: Whether users will find `/claude-tree:launch` vs `/claude-tree` intuitive enough, or if a shorter alias pattern should be documented
   - Recommendation: Ship with namespaced commands and document them clearly in README. Users can always add their own `.claude/commands/claude-tree.md` that just calls `/claude-tree:launch`.

2. **GitHub repo name / npm scoping**
   - What we know: npm package is `claude-directory-tree` (unscoped, locked). GitHub repo name is undecided.
   - What's unclear: The GitHub repo URL (e.g., `github.com/furqantariq/claude-directory-tree`) — if the repo already exists with commits, this is just publishing. If a new repo needs creating, that's a task.
   - Recommendation: Treat repo creation as a task if not already done.

3. **`$ARGUMENTS` default behavior for plugin directory**
   - What we know: `$ARGUMENTS` captures user text after command name. If empty, `npx claude-directory-tree` defaults to `process.cwd()`, which Claude Code sets to the current project root.
   - What's unclear: Whether Claude Code's cwd when running a command is reliably the project root.
   - Recommendation: The CLI defaults to `process.cwd()` — if the user is in Claude Code, cwd is the project root. This matches the locked decision. No change needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 4 is a packaging/distribution phase. The success criteria are:
1. `/claude-tree:launch` (or equivalent) starts the server and opens the browser
2. `npx claude-directory-tree` works from any directory
3. Target directory defaults correctly

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `npm pack` produces expected files (dist/, README, LICENSE, package.json) | manual/smoke | `npm pack && tar -tf *.tgz` | N/A (manual) |
| Plugin structure validates | manual | `claude plugin validate ./plugin` | ❌ Wave 0 |
| `npx claude-directory-tree` launches correctly | manual | run from temp dir | N/A |
| Plugin command file content is correct | unit (file read) | read and assert content | ❌ Wave 0 |

**Note:** Most of Phase 4 is not unit-testable in the traditional sense. Correctness is verified by:
- `npm pack` + tarball inspection
- `claude plugin validate`
- Manual smoke test of `npx` and plugin install

### Sampling Rate
- **Per task commit:** `npm test` (existing test suite must stay green)
- **Phase gate:** `npm pack && tar -tf *.tgz` inspected manually + `claude plugin validate ./plugin`

### Wave 0 Gaps
- No new test files needed (no new application logic). Existing tests cover the CLI and server behavior that `npx` exercises.
- The `plugin/` directory is pure config files (JSON, markdown) — no test coverage needed.

---

## Sources

### Primary (HIGH confidence)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) - plugin.json schema, directory structure, env vars, CLI commands, caching behavior
- [Claude Code Discover and Install Plugins](https://code.claude.com/docs/en/discover-plugins) - marketplace add flow, install scopes, `--plugin-dir` flag
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) - marketplace.json schema, plugin sources (relative, GitHub, npm), strict mode
- [Claude Code Create Plugins](https://code.claude.com/docs/en/plugins) - command file format, `$ARGUMENTS`, skill vs command distinction, test with `--plugin-dir`

### Secondary (MEDIUM confidence)
- [npm docs: files field and .npmignore](https://github.com/npm/cli/wiki/Files-&-Ignores) - files field allowlist behavior, .gitignore override

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Plugin system mechanics: HIGH — verified from official Claude Code docs directly
- npm publish workflow: HIGH — verified from official npm docs
- Command naming/namespacing: HIGH — documented in plugins reference
- UX of final command names: MEDIUM — user preference dimension not researchable

**Research date:** 2026-03-31
**Valid until:** 2026-06-01 (plugin system is evolving, but stable for current features)
