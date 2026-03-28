import { useMemo } from 'react';
import { useTree } from '@headless-tree/react';
import { syncDataLoaderFeature } from '@headless-tree/core';
import { Button } from '@/components/ui/button';
import { TreeItem } from '@/components/tree/TreeItem';
import { TreeSkeleton } from '@/components/tree/TreeSkeleton';
import { TreeToolbar } from '@/components/tree/TreeToolbar';
import { TYPE_LABELS } from '@/components/tree/iconMap';
import { deriveVisibleTree } from '@/lib/deriveVisibleTree';
import type { ArtifactType, ScopeNode, Artifact } from '@/lib/types';
import type { TreeNodeData } from '@/components/tree/TreeItem';

interface ArtifactTreeProps {
  scopes: ScopeNode[];
  query: string;
  typeFilter: ArtifactType | null;
  onQueryChange: (q: string) => void;
  onTypeFilterChange: (t: ArtifactType | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
  error: string | null;
}

function buildItemMaps(filteredScopes: ScopeNode[]): {
  items: Record<string, TreeNodeData>;
  children: Record<string, string[]>;
} {
  const items: Record<string, TreeNodeData> = {
    root: { nodeKind: 'root' },
  };
  const children: Record<string, string[]> = {
    root: filteredScopes.map((s) => s.id),
  };

  for (const scope of filteredScopes) {
    items[scope.id] = { ...scope, nodeKind: 'scope' };

    // Group artifacts by type into category nodes
    const categoryMap = new Map<ArtifactType, Artifact[]>();

    for (const artifact of scope.artifacts) {
      if (!categoryMap.has(artifact.type)) {
        categoryMap.set(artifact.type, []);
      }
      categoryMap.get(artifact.type)!.push(artifact);
    }

    const categoryIds: string[] = [];
    for (const [type, artifacts] of categoryMap.entries()) {
      const categoryId = `${scope.id}:${type}`;
      categoryIds.push(categoryId);

      items[categoryId] = {
        nodeKind: 'category',
        id: categoryId,
        type,
        children: artifacts,
        count: countArtifacts(artifacts),
      };

      const leafIds: string[] = [];
      for (const artifact of artifacts) {
        indexArtifact(artifact, items, leafIds);
      }
      children[categoryId] = leafIds;
    }

    children[scope.id] = categoryIds;
  }

  return { items, children };
}

function countArtifacts(artifacts: Artifact[]): number {
  return artifacts.reduce((sum, a) => {
    if (a.children && a.children.length > 0) return sum + countArtifacts(a.children);
    return sum + 1;
  }, 0);
}

function indexArtifact(
  artifact: Artifact,
  items: Record<string, TreeNodeData>,
  siblingIds: string[]
): void {
  siblingIds.push(artifact.id);

  if (artifact.children && artifact.children.length > 0) {
    // Plugin with children — treat as folder node
    items[artifact.id] = { ...artifact, nodeKind: 'leaf' };
    const childIds: string[] = [];
    for (const child of artifact.children) {
      indexArtifact(child, items, childIds);
    }
    // We store children even for leaf-typed plugins so tree can render them
    // (headless-tree isItemFolder uses nodeKind, so we keep it 'leaf' and
    //  rely on children array presence for nesting — update: categories handle this)
  } else {
    items[artifact.id] = { ...artifact, nodeKind: 'leaf' };
  }
}

export function ArtifactTree({
  scopes,
  query,
  typeFilter,
  onQueryChange,
  onTypeFilterChange,
  onRefresh,
  isLoading,
  error,
}: ArtifactTreeProps) {
  const filteredScopes = useMemo(
    () => deriveVisibleTree(scopes, query, typeFilter),
    [scopes, query, typeFilter]
  );

  const { items, children } = useMemo(
    () => buildItemMaps(filteredScopes),
    [filteredScopes]
  );

  // Stable dataLoader reference to preserve expand state across filter updates
  const dataLoader = useMemo(
    () => ({
      getItem: (id: string) => items[id],
      getChildren: (id: string) => children[id] ?? [],
    }),
    [items, children]
  );

  const tree = useTree<TreeNodeData>({
    rootItemId: 'root',
    getItemName: (item) => {
      const d = item.getItemData();
      if (d.nodeKind === 'scope') return d.label;
      if (d.nodeKind === 'category') return TYPE_LABELS[d.type];
      if (d.nodeKind === 'leaf') return d.name;
      return 'root';
    },
    isItemFolder: (item) => item.getItemData().nodeKind !== 'leaf',
    dataLoader,
    initialState: { expandedItems: filteredScopes.map((s) => s.id) },
    features: [syncDataLoaderFeature],
  });

  const hasActiveFilters = Boolean(query || typeFilter);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TreeToolbar
        query={query}
        typeFilter={typeFilter}
        onQueryChange={onQueryChange}
        onTypeFilterChange={onTypeFilterChange}
        onRefresh={onRefresh}
        isLoading={isLoading}
      />

      {/* Loading state (only when we have no data yet) */}
      {isLoading && scopes.length === 0 && <TreeSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12 text-center">
          <p className="text-sm font-semibold">Could not load artifacts</p>
          <p className="text-sm text-muted-foreground">
            Failed to scan directory. Check that the path exists and try again.
          </p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      )}

      {/* No-match state */}
      {!isLoading && !error && filteredScopes.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12 text-center">
          <p className="text-sm font-semibold">No matching artifacts</p>
          <p className="text-sm text-muted-foreground">
            No artifacts matching your filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onQueryChange('');
              onTypeFilterChange(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Empty state (no filters, just no data) */}
      {!isLoading && !error && filteredScopes.length === 0 && !hasActiveFilters && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12 text-center">
          <p className="text-sm font-semibold">No Claude artifacts found</p>
          <p className="text-sm text-muted-foreground">
            No Claude artifacts found in the scanned directory. Check your scan path or add
            projects manually.
          </p>
        </div>
      )}

      {/* Tree */}
      {!isLoading && !error && filteredScopes.length > 0 && (
        <div
          {...tree.getContainerProps()}
          className="flex-1 overflow-y-auto px-2 py-2 outline-none"
        >
          {tree.getItems().map((item) => (
            <div
              key={item.getId()}
              style={{ paddingLeft: item.getItemMeta().level * 16 }}
              {...item.getProps()}
            >
              <TreeItem item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
