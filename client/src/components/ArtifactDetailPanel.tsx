import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ICON_MAP, TYPE_LABELS } from '@/components/tree/iconMap';
import { cn } from '@/lib/utils';
import { describeArtifact } from '@/lib/operationsApi';
import type { Artifact } from '@/lib/types';

interface ArtifactDetailPanelProps {
  artifact: Artifact | null;
  onClose: () => void;
}

export function ArtifactDetailPanel({ artifact, onClose }: ArtifactDetailPanelProps) {
  const [description, setDescription] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact) {
      setDescription(null);
      return;
    }
    // Fast path: frontmatter description
    if (artifact.frontmatter?.description) {
      setDescription(String(artifact.frontmatter.description));
      return;
    }
    // Fallback: fetch from server (reads file, extracts first paragraph)
    // Virtual artifacts: strip # fragment for real path
    const filePath = artifact.absolutePath.includes('#')
      ? artifact.absolutePath.split('#')[0]
      : artifact.absolutePath;
    describeArtifact(filePath).then((r: { description: string | null }) => setDescription(r.description));
  }, [artifact]);

  if (!artifact) return null;

  const Icon = ICON_MAP[artifact.type] ?? ICON_MAP['unknown'];

  return (
    <div
      className={cn(
        'w-[280px] shrink-0 border-l border-border bg-muted/50 overflow-y-auto transition-all duration-150'
      )}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <h2 className="text-base font-semibold truncate pr-2">{artifact.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          aria-label="Close detail panel"
        >
          <X size={16} />
        </button>
      </div>
      <div className="px-4 pb-2 flex items-center gap-1.5">
        <Icon size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">{TYPE_LABELS[artifact.type]}</span>
      </div>
      <div className="px-4 pb-2">
        <span className="text-xs text-muted-foreground">
          {artifact.scope === 'global' ? 'Global' : artifact.projectId}
        </span>
      </div>
      <div className="px-4 pb-3">
        <span
          className="text-xs text-muted-foreground font-mono truncate block"
          title={artifact.absolutePath}
        >
          {artifact.absolutePath}
        </span>
      </div>
      <div className="mx-4 border-t border-border" />
      <div className="px-4 pt-3 pb-4">
        <p className="text-sm text-foreground">{description ?? 'No description available.'}</p>
      </div>
    </div>
  );
}
