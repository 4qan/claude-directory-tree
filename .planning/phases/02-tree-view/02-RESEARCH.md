# Phase 2: Tree View - Research

**Researched:** 2026-03-28
**Domain:** React tree component, client-side filtering, shadcn UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tree layout & hierarchy**
- Scope-first organization: top level = Global, Project A, Project B...
- Each scope expands to show artifact category nodes (Agents, Commands, Skills, etc.)
- Each category expands to show individual artifacts
- Plugins render as a special category node under their parent scope, with internal artifacts (agents, commands, skills) as expandable children inside
- Default state on load: scopes expanded, categories collapsed
- Empty categories hidden (only show categories with at least one artifact)
- Empty scopes hidden entirely (projects with zero artifacts not shown)

**Icons, labels & badges**
- Lucide SVG icons per artifact type (already installed via lucide-react)
- Icon mapping: Bot for agents, Terminal for commands, Zap for skills, Link for MCP, FileText for CLAUDE.md, etc.
- Scope badge: subtle muted text label ("global" / "project") next to scope name
- Artifact counts: parenthetical after category name, e.g., "Agents (3)"
- Artifact labels: name only (type implied by parent category and icon)

**Search & type filtering**
- Top toolbar pinned above tree: search input + type filter dropdown
- Search matches artifact names only (not frontmatter or project names)
- Type filter is a dropdown listing all artifact types
- Search + type filter use AND logic (both conditions must match)
- Filtered tree preserves hierarchy (scope > category > artifact), hiding non-matching nodes
- No-match state: "No artifacts matching [query]" with a "Clear filters" link

**Empty & loading states**
- Loading: skeleton tree with shimmer bars showing placeholder scope and category structure
- Empty tree (no projects found): centered guidance message, "No Claude artifacts found in [directory]" with hint about scan path
- No search matches: inline message with "Clear filters" action for quick recovery

### Claude's Discretion
- Exact lucide icon choices per artifact type
- Skeleton tree shimmer implementation details
- Refresh button placement and style
- Tree indentation spacing and expand/collapse chevron style
- Type filter dropdown component choice

### Deferred Ideas (OUT OF SCOPE)
None. Discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TREE-01 | Hierarchical tree with expand/collapse showing artifacts by scope (global vs project) | @headless-tree/react useTree + syncDataLoaderFeature handles expand/collapse; data from ScopeNode[] |
| TREE-02 | Each artifact displays a type-specific icon and label | lucide-react already installed; icon map keyed on ArtifactType enum |
| TREE-03 | Each scope node shows a badge indicating global or project-local | Artifact.scope field already in type contract; render as Tailwind badge |
| TREE-04 | Each scope/category node shows artifact count | ScopeNode.artifactCount available; category counts computed client-side |
| TREE-05 | Empty scopes/categories show graceful empty state with guidance | Application-level: filter out empty nodes before passing to tree data loader |
| TREE-06 | User can manually refresh the tree | Re-invoke GET /api/scan; button in toolbar; loading state already in App.tsx |
| TREE-07 | User can filter tree by artifact type | Application-level dropdown filter; re-derive visible tree from full scan data |
| TREE-08 | User can search/filter artifacts by name with live filtering | Application-level debounced input; re-derive visible tree from full scan data |
</phase_requirements>

---

## Summary

Phase 2 is a pure client-side UI phase. The data contract is already complete (ScopeNode[] from GET /api/scan), so the work is entirely about transforming that data into a VS Code-style file explorer.

The core challenge is **not** the tree component itself -- @headless-tree/react handles expand/collapse mechanics. The non-trivial work is (1) the filtering pipeline that re-derives a visible subtree from the raw scan data on every search/type-filter change, and (2) installing and wiring @headless-tree/react, which is decided but not yet installed.

Headless-tree's built-in "search" is typeahead keyboard navigation, not a filter-to-visible-nodes behavior. The CONTEXT.md filtering requirement (hide non-matching nodes, preserve hierarchy) must be implemented as application-level data transformation before the tree data loader sees the data.

**Primary recommendation:** Build a `deriveVisibleTree(scopes, query, typeFilter)` pure function that produces a filtered ScopeNode[] from the raw scan response. Pass its output to @headless-tree's dataLoader. This keeps the tree component stateless about filtering.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @headless-tree/react | 1.6.3 | Tree expand/collapse, item rendering API | Decided in Phase 1; peer deps accept React * |
| @headless-tree/core | 1.6.3 | Feature modules (syncDataLoaderFeature) | Required peer of react package |
| lucide-react | ^1.7.0 | Type-specific icons | Already installed; used in App.tsx |
| react | ^19.2.4 | UI framework | Project stack |
| tailwindcss | ^4.2.2 | Styling | Project stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx / tailwind-merge | installed | Conditional classes | Already available via `cn()` in lib/utils.ts |
| shadcn Button | installed | Refresh button, Clear filters | Already in components/ui/button.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @headless-tree/react | react-arborist | react-arborist has more examples but headless-tree was already decided |
| @headless-tree/react | Hand-rolled recursion | Much more work to get keyboard nav, accessibility, expand state correct |
| shadcn Select for type filter | Native `<select>` | shadcn consistent with existing UI; native is simpler but visually inconsistent |

**Installation (client is monorepo root, not separate workspace):**
```bash
npm install @headless-tree/react @headless-tree/core
```

**Version verification:** Both packages confirmed at 1.6.3 via `npm view` (2026-03-28). Peer deps accept `react: *` -- React 19 compatible.

---

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── components/
│   ├── tree/
│   │   ├── ArtifactTree.tsx      # root tree component (useTree hook, container)
│   │   ├── TreeToolbar.tsx       # search input + type filter dropdown + refresh button
│   │   ├── TreeItem.tsx          # renders a single tree row (icon, label, badge, count)
│   │   ├── TreeSkeleton.tsx      # loading shimmer placeholder
│   │   └── iconMap.ts            # ArtifactType -> LucideIcon mapping
│   └── ui/
│       └── (existing shadcn components)
├── lib/
│   ├── utils.ts                  # existing cn() utility
│   └── deriveVisibleTree.ts      # pure filter function: ScopeNode[] -> ScopeNode[]
└── App.tsx                       # owns scan state, passes to ArtifactTree
```

### Pattern 1: Filtered Tree Derivation
**What:** A pure function transforms the raw ScopeNode[] based on active search query and type filter before the tree component sees it.
**When to use:** Any time search query or type filter changes.
**Example:**
```typescript
// client/src/lib/deriveVisibleTree.ts
import type { ScopeNode, ArtifactType, Artifact } from '../../src/scanner/types';

export function deriveVisibleTree(
  scopes: ScopeNode[],
  query: string,
  typeFilter: ArtifactType | null
): ScopeNode[] {
  const q = query.trim().toLowerCase();

  return scopes
    .map((scope) => {
      // Filter artifacts recursively
      const filtered = filterArtifacts(scope.artifacts, q, typeFilter);
      return { ...scope, artifacts: filtered, artifactCount: countAll(filtered) };
    })
    .filter((scope) => scope.artifactCount > 0);
}

function filterArtifacts(
  artifacts: Artifact[],
  q: string,
  typeFilter: ArtifactType | null
): Artifact[] {
  return artifacts.flatMap((artifact) => {
    const children = artifact.children
      ? filterArtifacts(artifact.children, q, typeFilter)
      : undefined;

    const nameMatch = !q || artifact.name.toLowerCase().includes(q);
    const typeMatch = !typeFilter || artifact.type === typeFilter;

    if (children && children.length > 0) {
      // Category/plugin node: keep if it has surviving children
      return [{ ...artifact, children }];
    }
    // Leaf artifact: keep if both filters pass
    return nameMatch && typeMatch ? [artifact] : [];
  });
}
```

### Pattern 2: @headless-tree/react Setup
**What:** `useTree` with `syncDataLoaderFeature` wired to the derived (filtered) ScopeNode data.
**When to use:** Single tree instance in `ArtifactTree.tsx`.
**Example:**
```typescript
// Source: headless-tree.lukasbach.com/getstarted
import { syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';

const tree = useTree<Artifact | ScopeNode>({
  rootItemId: 'root',
  getItemName: (item) => item.getItemData().label ?? item.getItemData().name,
  isItemFolder: (item) => /* has children */ true,
  dataLoader: {
    getItem: (id) => itemMap[id],
    getChildren: (id) => childMap[id] ?? [],
  },
  initialState: {
    expandedItems: scopeIds, // scopes expanded by default
  },
  features: [syncDataLoaderFeature],
});

// Render
return (
  <div {...tree.getContainerProps()} className="outline-none">
    {tree.getItems().map((item) => (
      <div
        key={item.getItemId()}
        style={{ paddingLeft: `${item.getItemMeta().level * 16}px` }}
        {...item.getProps()}
      >
        <TreeItem item={item} />
      </div>
    ))}
  </div>
);
```

### Pattern 3: Flat Item Map from ScopeNode[]
**What:** @headless-tree requires a flat lookup by ID. Transform ScopeNode[] into `{ [id]: data }` and `{ [id]: string[] }` maps.
**When to use:** Inside `ArtifactTree.tsx` before calling `useTree`.
**Example:**
```typescript
function buildItemMaps(scopes: ScopeNode[]) {
  const items: Record<string, unknown> = { root: { label: 'root' } };
  const children: Record<string, string[]> = { root: scopes.map(s => s.id) };

  for (const scope of scopes) {
    items[scope.id] = scope;
    children[scope.id] = scope.artifacts.map(a => a.id);
    indexArtifacts(scope.artifacts, items, children);
  }
  return { items, children };
}
```

### Anti-Patterns to Avoid
- **Filtering inside the tree renderer:** Don't conditionally skip rendering items in the `tree.getItems()` loop. headless-tree's item list is already computed from the data loader. Filter data before it enters the tree.
- **Storing filter state in tree component:** Keep `query` and `typeFilter` in App.tsx or a shared state; tree component is a pure renderer.
- **Re-instantiating `useTree` on each filter change:** Use stable `dataLoader` reference (useMemo on item maps) so headless-tree preserves expand state across filter updates.
- **Rebuilding itemMaps inside useTree config object literal:** This creates a new object reference each render. Memoize item maps separately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse state management | Custom useState toggle tree | @headless-tree/react | Handles multi-level, keyboard shortcuts, accessibility roles |
| Tree keyboard navigation | Arrow key handlers | @headless-tree/react (built-in) | Already wired via getContainerProps/item.getProps |
| Icon per type | Switch statement inline | `iconMap.ts` module | Centralises mapping; reused in Phase 3 context menu |
| Tailwind shimmer animation | Custom CSS | Tailwind's `animate-pulse` | Built into Tailwind 4 |

---

## Common Pitfalls

### Pitfall 1: useTree dataLoader reference instability
**What goes wrong:** New object literal passed to `dataLoader` on every render causes headless-tree to reset expand state on every keystroke.
**Why it happens:** React re-renders App.tsx on query change; dataLoader object is recreated.
**How to avoid:** Wrap item map computation in `useMemo`, pass stable references.
**Warning signs:** Tree collapses back to default state when user types in search box.

### Pitfall 2: Category nodes vs leaf artifact nodes need different rendering
**What goes wrong:** Treating all tree nodes identically hides that some nodes are "category headers" (Agents, Commands) and some are actual files.
**Why it happens:** Both pass through `tree.getItems()` with the same shape.
**How to avoid:** Check `item.isFolder()` or a `nodeType` field on item data to branch rendering logic in `TreeItem.tsx`.

### Pitfall 3: headless-tree "search" is typeahead, not filtering
**What goes wrong:** Attempting to use headless-tree's built-in search to hide non-matching nodes. It doesn't do that -- it moves focus.
**Why it happens:** Confusing "search feature" label with filter-to-visible behavior.
**How to avoid:** Implement filtering entirely in `deriveVisibleTree`; don't pass a search feature to `useTree` for this use case.

### Pitfall 4: Type imports from server types in client code
**What goes wrong:** Importing from `../../src/scanner/types` in client code works in dev (Vite resolves it) but breaks if paths change.
**Why it happens:** Types live in server package, client needs them for the API response shape.
**How to avoid:** Either duplicate the minimal types in client (acceptable since they're simple), or ensure the import path is stable. The existing App.tsx already duplicates the ScanResponse inline -- follow that pattern or create `client/src/lib/types.ts`.

### Pitfall 5: Client test environment lacks DOM
**What goes wrong:** `vitest.config.ts` currently sets `environment: 'node'`. React component tests need jsdom.
**Why it happens:** Phase 1 only needed node tests; vitest config wasn't set up for components.
**How to avoid:** Add a separate vitest config for client tests using `environment: 'jsdom'`, or add `@vitest/browser` / `happy-dom`. See Wave 0 gap below.

---

## Code Examples

### Icon Map
```typescript
// client/src/components/tree/iconMap.ts
import { Bot, Terminal, Zap, Link, FileText, Box, Webhook, BookOpen, FileCode, HelpCircle } from 'lucide-react';
import type { ArtifactType } from '../../../src/scanner/types'; // or local copy

export const ICON_MAP: Record<ArtifactType, React.ComponentType<{ size?: number; className?: string }>> = {
  agent: Bot,
  command: Terminal,
  skill: Zap,
  'mcp-config': Link,
  'claude-md': FileText,
  plugin: Box,
  hook: Webhook,
  memory: BookOpen,
  plan: FileCode,
  unknown: HelpCircle,
};
```

### Toolbar with search + type filter
```typescript
// client/src/components/tree/TreeToolbar.tsx
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  query: string;
  typeFilter: string;
  onQueryChange: (q: string) => void;
  onTypeFilterChange: (t: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}
```

### Skeleton shimmer (Tailwind animate-pulse)
```typescript
function TreeSkeleton() {
  return (
    <div className="space-y-2 p-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-5 bg-muted rounded w-32 mb-1" />
          {[1, 2].map((j) => (
            <div key={j} className="ml-4 h-4 bg-muted rounded w-48 mb-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-treeview (unmaintained) | @headless-tree/react | 2023+ | Accessible, composable, no opinion on styling |
| Tailwind animate-spin only | animate-pulse for skeleton | Tailwind v2+ | Native shimmer without custom CSS |

---

## Open Questions

1. **shadcn Select vs native `<select>` for type filter dropdown**
   - What we know: shadcn Select requires @radix-ui/react-select (not yet installed); native select is functional
   - What's unclear: Whether the added package weight is worth it for one dropdown
   - Recommendation: Use shadcn Select for visual consistency if radix-ui/react-select install is acceptable; otherwise native select with Tailwind styling is fine

2. **Client-side test setup (jsdom)**
   - What we know: vitest.config.ts uses `environment: 'node'`; component tests need jsdom or happy-dom
   - What's unclear: Whether the project wants React component tests at all (Phase 1 had zero)
   - Recommendation: Add `happy-dom` for client component tests; it's lighter than jsdom and vitest supports it natively

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

**Note:** Current vitest config sets `environment: 'node'`. Component tests for the tree require DOM environment. Wave 0 must address this.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREE-01 | deriveVisibleTree preserves hierarchy when no filters active | unit | `npm test -- tests/deriveVisibleTree.test.ts` | Wave 0 |
| TREE-02 | iconMap returns a defined component for every ArtifactType value | unit | `npm test -- tests/iconMap.test.ts` | Wave 0 |
| TREE-03 | Scope badge renders "global" / "project" text | component | `npm test -- tests/ArtifactTree.test.tsx` | Wave 0 |
| TREE-04 | Category node label shows artifact count | component | `npm test -- tests/ArtifactTree.test.tsx` | Wave 0 |
| TREE-05 | deriveVisibleTree filters out empty scopes and categories | unit | `npm test -- tests/deriveVisibleTree.test.ts` | Wave 0 |
| TREE-06 | Refresh button triggers re-fetch of /api/scan | component | `npm test -- tests/ArtifactTree.test.tsx` | Wave 0 |
| TREE-07 | deriveVisibleTree filters by type; only matching artifacts visible | unit | `npm test -- tests/deriveVisibleTree.test.ts` | Wave 0 |
| TREE-08 | deriveVisibleTree filters by name substring (case-insensitive) | unit | `npm test -- tests/deriveVisibleTree.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/deriveVisibleTree.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/deriveVisibleTree.test.ts` -- covers TREE-01, TREE-05, TREE-07, TREE-08
- [ ] `tests/iconMap.test.ts` -- covers TREE-02
- [ ] `tests/ArtifactTree.test.tsx` -- covers TREE-03, TREE-04, TREE-06 (requires DOM env)
- [ ] DOM environment setup: add `happy-dom` to devDependencies and update `vitest.config.ts` to support `environment: 'happy-dom'` for `*.tsx` test files, or use a separate `vitest.client.config.ts`

---

## Sources

### Primary (HIGH confidence)
- `npm view @headless-tree/react` -- version 1.6.3, peer deps verified 2026-03-28
- `npm view @headless-tree/core` -- version 1.6.3, 2026-03-28
- `src/scanner/types.ts` -- data contract confirmed (Artifact, ScopeNode, ScanResponse)
- `package.json` -- confirmed @headless-tree not yet installed; lucide-react at ^1.7.0 installed
- `vitest.config.ts` -- confirmed node environment only

### Secondary (MEDIUM confidence)
- [headless-tree.lukasbach.com/getstarted](https://headless-tree.lukasbach.com/getstarted/) -- useTree hook signature and render pattern
- [github.com/lukasbach/headless-tree](https://github.com/lukasbach/headless-tree) -- feature list and capabilities overview

### Tertiary (LOW confidence)
- WebSearch result summary on headless-tree features -- not directly verified against source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm registry
- Architecture: HIGH -- derived directly from existing type contract and headless-tree API
- Pitfalls: MEDIUM -- dataLoader instability and typeahead-vs-filter confusion are well-known patterns from tree library usage; DOM environment gap confirmed from actual config file

**Research date:** 2026-03-28
**Valid until:** 2026-04-27 (headless-tree is stable; Tailwind 4 API is stable)
