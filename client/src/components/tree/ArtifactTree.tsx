import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useTree } from '@headless-tree/react';
import { syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature } from '@headless-tree/core';
import { Button } from '@/components/ui/button';
import { TreeItem } from '@/components/tree/TreeItem';
import { TreeSkeleton } from '@/components/tree/TreeSkeleton';
import { TreeToolbar } from '@/components/tree/TreeToolbar';
import { TYPE_LABELS } from '@/components/tree/iconMap';
import { deriveVisibleTree } from '@/lib/deriveVisibleTree';
import { openInEditor, copyArtifact, TYPE_DIR_MAP } from '@/lib/operationsApi';
import { ContextMenu } from '@/components/ContextMenu';
import { showToast } from '@/components/Toast';
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
  onSelectedArtifactChange?: (artifact: Artifact | null) => void;
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

function findScopeForItem(
  itemId: string | null,
  items: Record<string, TreeNodeData>,
  children: Record<string, string[]>,
  scopes: ScopeNode[]
): ScopeNode | null {
  if (!itemId) return null;
  const data = items[itemId];
  if (!data) return null;
  if (data.nodeKind === 'scope') return data as ScopeNode;
  if (data.nodeKind === 'category') {
    const scopeId = data.id.split(':')[0];
    const scopeData = items[scopeId];
    return scopeData?.nodeKind === 'scope' ? (scopeData as ScopeNode) : null;
  }
  // Leaf node: first try matching via scope artifacts
  for (const scope of scopes) {
    if (scope.artifacts.some((a: Artifact) => a.id === itemId || a.children?.some((c: Artifact) => c.id === itemId))) {
      const scopeData = items[scope.id];
      return scopeData?.nodeKind === 'scope' ? (scopeData as ScopeNode) : null;
    }
  }
  // Fallback for deeply nested leaves: use the data.scope field directly
  // to find the matching ScopeNode from the scopes array
  if (data.nodeKind === 'leaf' && 'scope' in data && 'projectId' in data) {
    const leafData = data as Artifact & { nodeKind: 'leaf' };
    // Match by projectId first (more specific), then by scope
    const match = scopes.find(s =>
      (leafData.projectId && s.id === leafData.projectId) ||
      (leafData.projectId && s.label === leafData.projectId)
    );
    if (match) {
      const scopeData = items[match.id];
      return scopeData?.nodeKind === 'scope' ? (scopeData as ScopeNode) : match;
    }
    // Last resort: if scope is 'global', find the global scope node
    if (leafData.scope === 'global') {
      return scopes.find(s => s.scope === 'global') ?? null;
    }
  }
  return null;
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
  onSelectedArtifactChange,
}: ArtifactTreeProps) {
  const filteredScopes = useMemo(
    () => deriveVisibleTree(scopes, query, typeFilter),
    [scopes, query, typeFilter]
  );

  const { items, children } = useMemo(
    () => buildItemMaps(filteredScopes),
    [filteredScopes]
  );

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Clipboard state
  const [clipboardArtifact, setClipboardArtifact] = useState<(Artifact & { nodeKind: 'leaf' }) | null>(null);

  // Refs for focus management
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const typeFilterRef = useRef<HTMLSelectElement>(null);

  // Derive selected artifact from selection state
  const selectedArtifact = useMemo((): Artifact | null => {
    if (selectedIds.length !== 1) return null;
    const d = items[selectedIds[0]];
    return d?.nodeKind === 'leaf' ? (d as Artifact & { nodeKind: 'leaf' }) : null;
  }, [selectedIds, items]);

  // Notify parent when selectedArtifact changes
  useEffect(() => {
    onSelectedArtifactChange?.(selectedArtifact);
  }, [selectedArtifact, onSelectedArtifactChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeKind: 'leaf' | 'scope' | 'category';
    data: TreeNodeData;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, data: TreeNodeData) => {
    if (data.nodeKind === 'root') return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeKind: data.nodeKind as 'leaf' | 'scope' | 'category',
      data,
    });
  }, []);

  // Conflict state (for Cmd+V triggered copies)
  const [conflictState, setConflictState] = useState<{
    artifactName: string;
    targetProject: string;
    retryFn: () => Promise<void>;
  } | null>(null);

  // Stable dataLoader reference to preserve expand state across filter updates.
  // Return a fallback for missing items to prevent crashes when filters change.
  const dataLoader = useMemo(
    () => ({
      getItem: (id: string) => items[id] ?? { nodeKind: 'root' as const },
      getChildren: (id: string) => children[id] ?? [],
    }),
    [items, children]
  );

  const tree = useTree<TreeNodeData>({
    rootItemId: 'root',
    getItemName: (item) => {
      const d = item.getItemData();
      if (d.nodeKind === 'scope') return d.label;
      if (d.nodeKind === 'category') return d.label ?? TYPE_LABELS[d.type];
      if (d.nodeKind === 'leaf') return d.name;
      return 'root';
    },
    isItemFolder: (item) => item.getItemData().nodeKind !== 'leaf',
    dataLoader,
    initialState: { expandedItems: [], selectedItems: [], focusedItem: null },
    state: { selectedItems: selectedIds, focusedItem: focusedId },
    setSelectedItems: setSelectedIds,
    setFocusedItem: setFocusedId,
    onPrimaryAction: (item) => {
      const d = item.getItemData();
      if (d.nodeKind === 'leaf') {
        openInEditor(d.absolutePath);
      }
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  });

  // Rebuild tree when data changes (useTree only calls rebuildTree on mount)
  const prevDataRef = useRef(dataLoader);
  useEffect(() => {
    if (prevDataRef.current !== dataLoader) {
      prevDataRef.current = dataLoader;
      tree.rebuildTree();
    }
  }, [dataLoader, tree]);

  // Auto-expand all folders when a filter is active, collapse when cleared
  const hasActiveFilters = Boolean(query || typeFilter);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (hasActiveFilters) {
      const allFolderIds = Object.keys(items).filter(
        (id) => items[id].nodeKind !== 'leaf'
      );
      tree.applySubStateUpdate('expandedItems', () => allFolderIds);
      setIsExpanded(true);
    } else {
      tree.applySubStateUpdate('expandedItems', () => []);
      setIsExpanded(false);
    }
    tree.rebuildTree();
  }, [hasActiveFilters, items, filteredScopes, tree]);

  const handleToggleExpand = useCallback(() => {
    if (isExpanded) {
      tree.applySubStateUpdate('expandedItems', () => []);
      setIsExpanded(false);
    } else {
      const allFolderIds = Object.keys(items).filter(
        (id) => items[id].nodeKind !== 'leaf'
      );
      tree.applySubStateUpdate('expandedItems', () => allFolderIds);
      setIsExpanded(true);
    }
    tree.rebuildTree();
  }, [isExpanded, items, tree]);

  const handleSelect = useCallback((data: TreeNodeData) => {
    if (data.nodeKind === 'leaf') {
      setSelectedIds([data.id]);
    }
  }, []);

  const handleDoubleClick = useCallback((data: TreeNodeData) => {
    if (data.nodeKind === 'leaf') {
      openInEditor(data.absolutePath);
    }
  }, []);

  // Global Cmd+F handler: focuses search input from anywhere
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Tree container keyboard handler: merges with headless-tree's getContainerProps().onKeyDown
  const containerProps = tree.getContainerProps();

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Let headless-tree handle arrow keys, Enter, etc. first
    containerProps.onKeyDown?.(e as any);

    // Shift+F10 or ContextMenu key: open context menu on focused item
    if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
      e.preventDefault();
      if (focusedId && items[focusedId]) {
        const data = items[focusedId];
        if (data.nodeKind !== 'root') {
          const el = treeContainerRef.current?.querySelector(`[data-rct-item-id="${focusedId}"]`);
          const rect = el?.getBoundingClientRect();
          setContextMenu({
            x: rect ? rect.left + 20 : 100,
            y: rect ? rect.bottom : 100,
            nodeKind: data.nodeKind as 'leaf' | 'scope' | 'category',
            data,
          });
        }
      }
      return;
    }

    // Cmd+C: copy selected artifact to clipboard state
    // Only intercept when tree container is active (Pitfall 6: don't block native copy outside tree)
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      if (!treeContainerRef.current?.contains(document.activeElement)) return;
      if (selectedIds.length === 1) {
        const data = items[selectedIds[0]];
        if (data?.nodeKind === 'leaf') {
          e.preventDefault();
          setClipboardArtifact(data as Artifact & { nodeKind: 'leaf' });
          showToast('Copied to clipboard', 'info', 2000);
        }
      }
      return;
    }

    // Cmd+V: paste clipboard artifact into focused scope
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      if (!treeContainerRef.current?.contains(document.activeElement)) return;
      if (!clipboardArtifact) return; // silent fail per UI-SPEC
      e.preventDefault();

      // Determine target: find the scope of the currently focused item
      const targetScope = findScopeForItem(focusedId, items, children, scopes);
      if (!targetScope || targetScope.scope === 'global') {
        showToast('Select a project scope to paste into', 'error', 3000);
        return;
      }

      // Build destination dir using TYPE_DIR_MAP from operationsApi
      const typeDir = TYPE_DIR_MAP[clipboardArtifact.type] ?? '';
      const destDir = targetScope.rootPath + (typeDir ? '/' + typeDir : '');

      copyArtifact(clipboardArtifact.absolutePath, destDir, clipboardArtifact.type)
        .then((result: { success: boolean; conflict?: boolean; warnings?: { type: string; message: string }[]; error?: string }) => {
          if (result.conflict) {
            setConflictState({
              artifactName: clipboardArtifact.name,
              targetProject: targetScope.label,
              retryFn: async () => {
                await copyArtifact(clipboardArtifact.absolutePath, destDir, clipboardArtifact.type, true);
                showToast(`Copied ${clipboardArtifact.name} to ${targetScope.label}`, 'success');
                onRefresh();
              },
            });
          } else if (result.success) {
            showToast(`Copied ${clipboardArtifact.name} to ${targetScope.label}`, 'success');
            onRefresh();
          } else if (result.error) {
            showToast(`Failed to copy: ${result.error}`, 'error', 6000);
          }
        });
      return;
    }

    // Esc: close context menu first, then clear selection
    if (e.key === 'Escape') {
      if (contextMenu) {
        setContextMenu(null);
      } else if (selectedIds.length > 0) {
        setSelectedIds([]);
      }
    }
  }, [containerProps, focusedId, selectedIds, items, children, scopes, clipboardArtifact, contextMenu, onRefresh]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TreeToolbar
        query={query}
        typeFilter={typeFilter}
        onQueryChange={onQueryChange}
        onTypeFilterChange={onTypeFilterChange}
        onRefresh={onRefresh}
        isLoading={isLoading}
        searchInputRef={searchInputRef}
        typeFilterRef={typeFilterRef}
        treeContainerRef={treeContainerRef}
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

      {/* Tree bar + tree */}
      {!isLoading && !error && filteredScopes.length > 0 && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={handleToggleExpand}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          <span className="text-xs text-muted-foreground">
            {filteredScopes.length} {filteredScopes.length === 1 ? 'scope' : 'scopes'}
          </span>
        </div>
      )}
      {!isLoading && !error && filteredScopes.length > 0 && (() => {
        const treeItems = tree.getItems();
        let lastSection: string | null = null;

        return (
          <div
            ref={treeContainerRef}
            {...containerProps}
            onKeyDown={handleTreeKeyDown}
            className="flex-1 overflow-y-auto px-2 py-2 outline-none"
          >
            {treeItems.map((item) => {
              const data = item.getItemData();
              let sectionHeader: React.ReactNode = null;

              if (data.nodeKind === 'scope') {
                const section = data.section;
                if (section !== lastSection) {
                  lastSection = section;
                  const sectionLabels: Record<string, string> = {
                    current: 'Current Project',
                    projects: 'Other Projects',
                  };
                  if (section !== 'global' && sectionLabels[section]) {
                    sectionHeader = (
                      <div key={`section-${section}`} className="flex items-center gap-2 px-2 pt-4 pb-1">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{sectionLabels[section]}</span>
                        <div className="flex-1 border-t border-border" />
                      </div>
                    );
                  }
                }
              }

              const isLeafSelected = data.nodeKind === 'leaf' && selectedIds.includes(data.id);

              return (
                <div key={item.getId()}>
                  {sectionHeader}
                  <div
                    style={{ paddingLeft: item.getItemMeta().level * 16 }}
                    {...item.getProps()}
                  >
                    <TreeItem
                      item={item}
                      isSelected={isLeafSelected}
                      onSelect={handleSelect}
                      onDoubleClick={handleDoubleClick}
                      onContextMenu={handleContextMenu}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeKind={contextMenu.nodeKind}
          data={contextMenu.data}
          scopes={scopes}
          onClose={() => setContextMenu(null)}
          onRefresh={onRefresh}
        />
      )}
      {/* Conflict dialog for Cmd+V paste operations */}
      {conflictState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border border-border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold mb-2">File already exists</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{conflictState.artifactName}</strong> already exists in{' '}
              <strong>{conflictState.targetProject}</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConflictState(null)}
              >
                Keep Original
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  setConflictState(null);
                  await conflictState.retryFn();
                }}
              >
                Replace File
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
