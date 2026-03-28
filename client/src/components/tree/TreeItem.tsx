import { ChevronRight } from 'lucide-react';
import type { ItemInstance } from '@headless-tree/core';
import { ICON_MAP, TYPE_LABELS } from '@/components/tree/iconMap';
import { cn } from '@/lib/utils';
import type { ArtifactType } from '@/lib/types';
import type { ScopeNode, Artifact } from '@/lib/types';

// Union type representing what each tree node contains
export type TreeNodeData =
  | { nodeKind: 'root' }
  | (ScopeNode & { nodeKind: 'scope' })
  | { nodeKind: 'category'; id: string; type: ArtifactType; children: Artifact[]; count: number }
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
        <span className="text-xs text-muted-foreground">{data.scope}</span>
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
        <span className="text-sm font-semibold truncate">{TYPE_LABELS[data.type]}</span>
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
      </div>
    );
  }

  // root node — never rendered (headless-tree doesn't include root in getItems())
  return null;
}
