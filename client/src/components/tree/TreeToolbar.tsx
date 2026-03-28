import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ARTIFACT_TYPES } from '@/lib/types';
import { TYPE_LABELS } from '@/components/tree/iconMap';
import type { ArtifactType } from '@/lib/types';
import type React from 'react';

interface TreeToolbarProps {
  query: string;
  typeFilter: ArtifactType | null;
  onQueryChange: (q: string) => void;
  onTypeFilterChange: (t: ArtifactType | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  typeFilterRef?: React.RefObject<HTMLSelectElement | null>;
  treeContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function TreeToolbar({
  query,
  typeFilter,
  onQueryChange,
  onTypeFilterChange,
  onRefresh,
  isLoading,
  searchInputRef,
  typeFilterRef,
  treeContainerRef,
}: TreeToolbarProps) {
  // Tab cycling: search -> type filter -> tree
  const handleToolbarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey) return;

    if (document.activeElement === searchInputRef?.current) {
      e.preventDefault();
      typeFilterRef?.current?.focus();
    } else if (document.activeElement === typeFilterRef?.current) {
      e.preventDefault();
      treeContainerRef?.current?.focus();
    }
  };

  return (
    <div
      className="bg-background border-b border-border px-6 py-3 flex items-center gap-3"
      onKeyDown={handleToolbarKeyDown}
    >
      <div className="relative flex-1">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search artifacts..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search artifacts"
          className="pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <Select
        ref={typeFilterRef}
        value={typeFilter ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onTypeFilterChange(val === '' ? null : (val as ArtifactType));
        }}
        aria-label="Filter by artifact type"
      >
        <option value="">All types</option>
        {ARTIFACT_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        aria-label="Refresh artifact tree"
      >
        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
      </Button>
    </div>
  );
}
