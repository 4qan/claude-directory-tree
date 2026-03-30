---
phase: quick
plan: 260330-qpc
type: execute
wave: 1
depends_on: []
files_modified:
  - src/scanner/classify.ts
  - tests/fixtures/.claude/plugins/cached-plugin/.claude-plugin/plugin.json
  - tests/fixtures/.claude/plugins/cached-plugin/agents/reviewer.md
  - tests/fixtures/.claude/plugins/cached-plugin/commands/deploy.md
  - tests/classify.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Plugins from ~/.claude/plugins/cache/ show their internal agents, commands, skills as children"
    - "Existing test-fixture plugins (plugin.json directly in dir) still expand correctly"
    - "Plugin children are not duplicated at top level"
  artifacts:
    - path: "src/scanner/classify.ts"
      provides: "Fixed expandPlugin call site that resolves correct plugin root"
    - path: "tests/classify.test.ts"
      provides: "Tests for .claude-plugin/ nested structure"
  key_links:
    - from: "classifyScope"
      to: "expandPlugin"
      via: "pluginDir resolution handles both direct and .claude-plugin/ layouts"
      pattern: "path\\.dirname.*\\.claude-plugin"
---

<objective>
Fix plugin internal visibility so the scanner recurses into the correct directory for cached plugins.

Purpose: Cached plugins (the real-world structure) have `version-dir/.claude-plugin/plugin.json` with artifacts in `version-dir/agents/`, `version-dir/commands/`, etc. Currently `expandPlugin` receives the `.claude-plugin/` directory (the parent of plugin.json) but the artifacts live as siblings of `.claude-plugin/`, one level up. The fix is to detect this layout and scan the correct root.

Output: Plugin children populated for both fixture-style (`plugin-dir/plugin.json`) and cache-style (`plugin-dir/.claude-plugin/plugin.json`) layouts.
</objective>

<execution_context>
@/Users/furqantariq/.claude/get-shit-done/workflows/execute-plan.md
@/Users/furqantariq/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/scanner/classify.ts
@src/scanner/types.ts
@tests/classify.test.ts

<interfaces>
From src/scanner/classify.ts:
```typescript
export async function expandPlugin(
  pluginDir: string,
  scope: 'global' | 'project',
  projectId: string,
  claudeDir: string,
): Promise<Artifact[]>;

export async function classifyScope(
  claudeDir: string,
  scope: 'global' | 'project',
  projectId: string,
): Promise<Artifact[]>;
```

Bug location in classifyScope (line 359):
```typescript
const pluginDir = path.dirname(artifact.absolutePath);
// For cached plugins: artifact.absolutePath = ".../version/.claude-plugin/plugin.json"
// path.dirname gives ".../version/.claude-plugin/" -- WRONG
// Should give ".../version/" (parent of .claude-plugin)
```

Test fixture layout (works):
```
plugins/test-plugin/plugin.json        <- path.dirname = test-plugin/ (correct)
plugins/test-plugin/commands/greet.md
```

Real cached layout (broken):
```
plugins/cache/org/name/1.0.0/.claude-plugin/plugin.json  <- path.dirname = .claude-plugin/ (wrong)
plugins/cache/org/name/1.0.0/agents/reviewer.md           <- lives in parent of .claude-plugin/
plugins/cache/org/name/1.0.0/commands/deploy.md
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add cached-plugin fixture and test, then fix pluginDir resolution</name>
  <files>
    tests/fixtures/.claude/plugins/cached-plugin/.claude-plugin/plugin.json,
    tests/fixtures/.claude/plugins/cached-plugin/agents/reviewer.md,
    tests/fixtures/.claude/plugins/cached-plugin/commands/deploy.md,
    tests/classify.test.ts,
    src/scanner/classify.ts
  </files>
  <behavior>
    - Test: cached-plugin (with .claude-plugin/plugin.json layout) has children array with 2 entries (agent + command)
    - Test: cached-plugin children include "reviewer" agent and "deploy" command
    - Test: existing test-plugin tests still pass (no regression)
    - Test: cached-plugin children are NOT duplicated at top level
  </behavior>
  <action>
    1. Create test fixture for cached plugin layout:
       - `tests/fixtures/.claude/plugins/cached-plugin/.claude-plugin/plugin.json` with `{"name": "cached-plugin"}`
       - `tests/fixtures/.claude/plugins/cached-plugin/agents/reviewer.md` with frontmatter `name: reviewer`
       - `tests/fixtures/.claude/plugins/cached-plugin/commands/deploy.md` with frontmatter `name: deploy`

    2. Add tests in tests/classify.test.ts:
       - "cached plugin with .claude-plugin/ layout has children populated"
       - "cached plugin children include reviewer agent and deploy command"
       - "cached plugin children not duplicated at top level"

    3. Run tests (RED: they will fail because pluginDir points to .claude-plugin/ not parent).

    4. Fix in src/scanner/classify.ts, in classifyScope around line 359:
       Change the pluginDir resolution from:
       ```typescript
       const pluginDir = path.dirname(artifact.absolutePath);
       ```
       To:
       ```typescript
       const pluginJsonDir = path.dirname(artifact.absolutePath);
       // Cached plugins: plugin.json lives in .claude-plugin/ subdir; artifacts are in the parent
       const pluginDir = path.basename(pluginJsonDir) === '.claude-plugin'
         ? path.dirname(pluginJsonDir)
         : pluginJsonDir;
       ```

    5. Run tests (GREEN: all pass).
  </action>
  <verify>
    <automated>cd "/Users/furqantariq/Documents/Projects/Claude Directory Tree" && npx vitest run tests/classify.test.ts</automated>
  </verify>
  <done>
    - cached-plugin fixture exists with .claude-plugin/ layout
    - All new tests pass: cached plugin has 2 children (reviewer agent, deploy command)
    - All existing plugin tests pass (test-plugin still works)
    - No children duplicated at top level
  </done>
</task>

</tasks>

<verification>
- `npx vitest run tests/classify.test.ts` -- all tests pass including new cached-plugin tests
- `npx vitest run` -- full test suite passes, no regressions
</verification>

<success_criteria>
- Plugins with `.claude-plugin/plugin.json` layout correctly show internal artifacts as children
- Plugins with direct `plugin.json` layout continue to work
- No top-level duplication of plugin children
</success_criteria>

<output>
After completion, create `.planning/quick/260330-qpc-plugin-internal-visibility-scanner-recur/260330-qpc-SUMMARY.md`
</output>
