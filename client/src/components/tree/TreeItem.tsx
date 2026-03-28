import { ChevronRight } from 'lucide-react';
import type { ItemInstance } from '@headless-tree/core';
import { ICON_MAP, TYPE_LABELS, MCP_SCOPE_LABELS } from '@/components/tree/iconMap';
import { cn } from '@/lib/utils';
import type { ArtifactType } from '@/lib/types';
import type { ScopeNode, Artifact } from '@/lib/types';

// Union type representing what each tree node contains
export type TreeNodeData =
  | { nodeKind: 'root' }
  | (ScopeNode & { nodeKind: 'scope' })
  | { nodeKind: 'category'; id: string; type: ArtifactType; label?: string; children: Artifact[]; count: number }
  | (Artifact & { nodeKind: 'leaf' });

interface TreeItemProps {
  item: ItemInstance<TreeNodeData>;
}

export function TreeItem({ item }: TreeItemProps) {
  const data = item.getItemData();
  const isFolder = item.isFolder();
  const isExpanded = isFolder && item.isExpanded();

  if (data.nodeKind === 'scope') {
    return (
      <div className="flex items-center gap-2 px-2 py-1 h-7 rounded-sm cursor-default hover:bg-muted">
        <ChevronRight
          size={16}
          className={cn(
            'text-muted-foreground transition-transform duration-150 shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <span className="text-sm font-semibold truncate">{data.label}</span>
      </div>
    );
  }

  if (data.nodeKind === 'category') {
    return (
      <div className="flex items-center gap-2 px-2 py-1 h-7 rounded-sm cursor-default hover:bg-muted">
        <ChevronRight
          size={16}
          className={cn(
            'text-muted-foreground transition-transform duration-150 shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <span className="text-sm font-semibold truncate">{data.label ?? TYPE_LABELS[data.type]}</span>
        <span className="text-xs text-muted-foreground">({data.count})</span>
      </div>
    );
  }

  if (data.nodeKind === 'leaf') {
    const Icon = ICON_MAP[data.type] ?? ICON_MAP['unknown'];
    return (
      <div className="flex items-center gap-2 px-2 py-1 h-7 rounded-sm cursor-default hover:bg-muted">
        {/* Spacer aligns leaf with category chevron */}
        <span className="w-4 shrink-0" />
        <Icon size={16} className="text-foreground shrink-0" />
        <span className="text-sm font-normal truncate">{data.name}</span>
        {data.mcpScope && (
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 leading-none',
            data.mcpScope === 'project' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
            data.mcpScope === 'local' && 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
            data.mcpScope === 'user' && 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
          )}>{data.mcpScope}</span>
        )}
        {data.type === 'plugin' && data.enabled !== undefined && (
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 leading-none',
            data.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
          )}>{data.enabled ? 'enabled' : 'disabled'}</span>
        )}
      </div>
    );
  }

  // root node — never rendered (headless-tree doesn't include root in getItems())
  return null;
}
