# Phase 1: Foundation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Working npx binary, artifact scanner, and server with typed REST API. Users can run `npx claude-directory-tree`, have it open a browser, and retrieve a fully typed artifact tree via the API. Cross-platform (macOS primary, Windows/Linux secondary).

</domain>

<decisions>
## Implementation Decisions

### Project Discovery
- CLI argument specifies the parent directory to scan: `npx claude-directory-tree ~/Projects`
- If no argument given, scan current working directory as fallback
- Unlimited scan depth (recursively find all `.claude/` directories), skipping `node_modules`, `.git`, and similar noise directories
- Global scope (`~/.claude/`) is always included automatically as a top-level node
- Manual project registration supported via both CLI flag (`--add /path`) and in-app UI button
- Registered projects persisted in a simple JSON file the app manages

### Startup Experience
- Verbose terminal output: list each discovered project with artifact count, then total summary and URL
- Auto-open browser after scan completes
- Auto-pick next available port if default is taken (print notice: "Port X in use, using Y")
- Persistent server: stays running until Ctrl+C, user can rescan anytime
- Rescan available via both browser refresh AND explicit rescan button in the UI

### Artifact Classification
- Detection uses both directory location AND frontmatter parsing for maximum accuracy
- Detection rules:
  - `/commands/*.md` -> Command (confirm via frontmatter)
  - `/agents/*.md` -> Agent (confirm via frontmatter)
  - `/skills/*.md` -> Skill (confirm via frontmatter)
  - `/hooks/` entries -> Hook (from settings.json)
  - `CLAUDE.md` -> CLAUDE.md (by name)
  - `.mcp.json` -> MCP config (by name)
  - `/memory/*.md` -> Memory file
  - `/plans/*.md` -> Plan file
  - `plugin.json` -> Plugin root
- Unclassifiable files shown as "Unknown" type in the tree (nothing hidden)
- Plugins are expanded to show their internal artifacts (commands, agents, skills, hooks) as children

### Claude's Discretion
- API response structure (nested tree vs flat list, field naming, pagination)
- Default port number
- JSON config file location and schema for persisted project registrations
- Skip-list for noise directories during recursive scan
- Frontmatter parsing strategy and fallback heuristics
- Error handling for inaccessible directories or permission issues

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs. Requirements are fully captured in decisions above and in:

### Project docs
- `.planning/REQUIREMENTS.md` -- INFRA-01 through INFRA-04, SCAN-01 through SCAN-04
- `.planning/PROJECT.md` -- Constraints (npm package, local-only, sub-second startup, macOS primary)
- `.planning/ROADMAP.md` -- Phase 1 success criteria and requirement mapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. Greenfield project, no source code exists yet.

### Established Patterns
- Stack decided: Fastify 5 + React 19 + Vite 8 + Tailwind 4 + @headless-tree/react + tsup
- Architecture: Two-build split (tsup for server, Vite for client)
- Atomic writes (write-file-atomic) from day one

### Integration Points
- `~/.claude/` directory structure is the source of truth for global artifacts
- Per-project `.claude/` directories for project-scoped artifacts
- `settings.json` within `.claude/` for hooks configuration
- `plugin.json` as plugin root marker

</code_context>

<specifics>
## Specific Ideas

- Terminal output should feel informative, not noisy: project list with counts, then summary line with URL
- Cross-platform is a hard requirement, not nice-to-have (Windows + macOS)
- User is not a developer, so contributor-friendliness of the codebase matters

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-28*
