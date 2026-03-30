# Phase 4: Plugin Distribution - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the working app as a Claude Code plugin (`/claude-tree` command) and npm package (`npx claude-directory-tree`) for frictionless install. The app is fully built (Phases 1-3.1). This phase is purely distribution and packaging.

</domain>

<decisions>
## Implementation Decisions

### Command naming
- Plugin command: `/claude-tree` (explicit, no collision risk)
- Secondary command: `/claude-tree-add` (registers a project without opening UI, maps to existing `--add` flag)
- npm binary name stays `claude-directory-tree`

### Target directory logic
- Both plugin and standalone use the same parent-directory scan logic
- Default: scan from cwd (standalone) or project root (plugin), always include registered projects + global scope
- Optional directory argument overrides the default in both contexts
- Universal view builds organically as users register projects via `--add` or `/claude-tree-add`
- No scanning from `~` (performance concern: would recurse through Library/, Applications/, etc.)

### npm package
- Unscoped package: `claude-directory-tree`
- Version: `0.1.0` (signals early/beta)
- README with text + screenshots/GIFs of the tree UI, context menu, detail panel

### Open source
- GitHub public repo, MIT license (already in package.json)

### Plugin implementation
- **Research directive:** Researcher must investigate Claude Code plugin best practices (plugin.json structure, command definitions, how plugins invoke tools/commands, installation mechanics). Implementation approach is Claude's discretion based on research findings.

### Installation & discovery
- **Research directive:** Researcher must investigate standard Claude Code plugin installation flow and open-source npm package distribution best practices. Determine the most frictionless path for both plugin users and npx users.

### Claude's Discretion
- Plugin.json structure and command wiring (informed by research)
- npm publish workflow (prepublish scripts, .npmignore, CI)
- Build output structure for distribution
- README content and screenshot selection
- Contributing guide structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project docs
- `.planning/REQUIREMENTS.md` -- Phase 4 requirements (currently TBD, to be derived from success criteria)
- `.planning/PROJECT.md` -- Constraints: npm package, zero-install via npx, local-only, MIT license
- `.planning/ROADMAP.md` -- Phase 4 success criteria: /tree command works, npx works, target directory defaults

### Existing code
- `src/cli.ts` -- Current CLI entry point with --add flag, port allocation, browser open logic
- `src/config/projects.ts` -- Project registration system (addProject, registered paths config)
- `tsup.config.ts` -- Current two-entry build (cli + server), shebang banner on CLI
- `package.json` -- Current package metadata, bin field, scripts, dependencies

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` -- Build tooling decisions, two-build split, tsup + Vite
- `.planning/phases/03-operations/03-CONTEXT.md` -- Filesystem operation patterns, atomic writes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.ts`: Complete CLI with arg parsing, port allocation, scan, server start, browser open. Plugin command can shell out to this or import `startServer` directly.
- `src/config/projects.ts`: `addProject()` function for registering project paths. Powers the `--add` flag and future `/claude-tree-add`.
- `tsup.config.ts`: Two-entry build already produces `dist/cli.js` (with shebang) and `dist/server/index.js`. May need a third entry for plugin command or may reuse CLI.
- `dist/` output: cli.js (35KB bundled), server/ directory. This is what ships in the npm package.

### Established Patterns
- Two-build split: tsup for server-side, Vite for client-side
- `dist/cli.js` is the npm bin entry point with shebang
- Fastify serves the built Vite client from `dist/server/client/`

### Integration Points
- Plugin needs `plugin.json` and command file(s) in a structure Claude Code recognizes
- npm package needs correct `files` field in package.json to include dist/ and plugin files
- `bin` field already maps `claude-directory-tree` to `./dist/cli.js`

</code_context>

<specifics>
## Specific Ideas

- User is new to open-source publishing; researcher should provide clear guidance on npm publish flow and GitHub repo setup
- Plugin installation should be as frictionless as possible; research standard Claude Code plugin install patterns
- README should include screenshots to help users understand what they're installing before running it

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>

---

*Phase: 04-plugin-distribution*
*Context gathered: 2026-03-31*
