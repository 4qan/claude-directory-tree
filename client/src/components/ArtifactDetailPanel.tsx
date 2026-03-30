import { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  FolderOpen,
  Clipboard,
  Copy,
  ArrowRight,
  ArrowUpCircle,
  ArrowDownCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { ICON_MAP, TYPE_LABELS_SINGULAR } from '@/components/tree/iconMap';
import { cn } from '@/lib/utils';
import { describeArtifact, openInEditor, copyPathToClipboard, togglePlugin } from '@/lib/operationsApi';
import { showToast } from '@/components/Toast';
import { ConflictDialog } from '@/components/ConflictDialog';
import { WarningDialog } from '@/components/WarningDialog';
import { useArtifactOperations } from '@/hooks/useArtifactOperations';
import { Button } from '@/components/ui/button';
import type { Artifact, ScopeNode } from '@/lib/types';

const BLOCKED_TYPES = ['hook', 'mcp-config', 'plugin', 'plan', 'memory', 'claude-md'];

interface ArtifactDetailPanelProps {
  artifact: Artifact | null;
  scopes: ScopeNode[];
  onClose: () => void;
  onRefresh: () => void;
}

export function ArtifactDetailPanel({ artifact, scopes, onClose, onRefresh }: ArtifactDetailPanelProps) {
  const [description, setDescription] = useState<string | null>(null);
  const ops = useArtifactOperations({ onRefresh, onClose });

  useEffect(() => {
    if (!artifact) {
      setDescription(null);
      return;
    }
    if (artifact.frontmatter?.description) {
      setDescription(String(artifact.frontmatter.description));
      return;
    }
    // For MCP configs, keep the #fragment so the server can extract the right entry
    const describePath = artifact.type === 'mcp-config'
      ? artifact.absolutePath
      : artifact.absolutePath.includes('#')
        ? artifact.absolutePath.split('#')[0]
        : artifact.absolutePath;
    describeArtifact(describePath).then((r: { description: string | null }) => setDescription(r.description));
  }, [artifact]);

  if (!artifact) return null;

  const Icon = ICON_MAP[artifact.type] ?? ICON_MAP['unknown'];
  const typeLabel = TYPE_LABELS_SINGULAR[artifact.type] ?? artifact.type;
  const isBlocked = BLOCKED_TYPES.includes(artifact.type);
  const projectScopes = scopes.filter((s) => s.scope === 'project');

  const handleCopyPath = async () => {
    await copyPathToClipboard(artifact.absolutePath);
    showToast('Path copied to clipboard');
  };

  const handleOpenInEditor = async () => {
    await openInEditor(artifact.absolutePath);
  };

  const handleRevealInFinder = async () => {
    const dirPath = artifact.absolutePath.substring(0, artifact.absolutePath.lastIndexOf('/'));
    await openInEditor(dirPath);
  };

  const handleTogglePlugin = async () => {
    if (!artifact || artifact.type !== 'plugin' || artifact.enabled === undefined) return;
    const newEnabled = !artifact.enabled;
    const parentScope = scopes.find((s) =>
      s.artifacts.some((a) => a.id === artifact.id || a.children?.some((c) => c.id === artifact.id))
    );
    if (!parentScope) return;
    const settingsPath = parentScope.rootPath + '/settings.json';
    const result = await togglePlugin(artifact.name, settingsPath, newEnabled);
    if (result.success) {
      showToast(newEnabled ? 'Plugin enabled' : 'Plugin disabled', 'success');
      onRefresh();
    } else {
      showToast(`Failed to update plugin: ${result.error}`, 'error', 6000);
    }
  };

  const showPromote = artifact.scope === 'project' && !isBlocked;
  const showDemote = artifact.scope === 'global' && !isBlocked;
  const showCopyMove = !isBlocked;

  return (
    <>
      <div className="w-[360px] shrink-0 border-l border-border bg-muted/30 overflow-y-auto flex flex-col">
        {/* Header: name + type inline */}
        <div className="px-5 pt-4 pb-1 flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Icon size={16} className="text-muted-foreground shrink-0" />
            <h2 className="text-base font-semibold truncate">{artifact.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
            aria-label="Close detail panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Meta: type + project */}
        <div className="px-5 pb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{TYPE_LABELS_SINGULAR[artifact.type]}</span>
          <span>in</span>
          <span className="font-medium text-foreground">
            {artifact.scope === 'global' ? 'Global (~/.claude)' : scopes.find(s => s.id === artifact.projectId)?.label ?? ''}
          </span>
        </div>

        <div className="mx-5 border-t border-border" />

        {/* Description */}
        <div className="px-5 pt-3 pb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-foreground leading-relaxed">{description ?? 'No description available.'}</p>
        </div>

        <div className="mx-5 border-t border-border" />

        {/* Actions */}
        <div className="px-5 pt-3 pb-4 flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Actions</p>
          <ActionButton icon={<ExternalLink size={14} />} label="Open in Editor" onClick={handleOpenInEditor} />
          <ActionButton icon={<FolderOpen size={14} />} label="Show in Folder" onClick={handleRevealInFinder} />
          <ActionButton icon={<Clipboard size={14} />} label="Copy Path" onClick={handleCopyPath} />
          {artifact.type === 'plugin' && artifact.enabled !== undefined && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 justify-start h-8 text-sm"
              onClick={handleTogglePlugin}
            >
              {artifact.enabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
              {artifact.enabled ? 'Disable' : 'Enable'}
            </Button>
          )}
          {showCopyMove && (
            <>
              <DropdownAction
                icon={<Copy size={14} />}
                label="Copy to..."
                scopes={projectScopes}
                onSelect={(s) => ops.copyTo(artifact, s)}
              />
              <DropdownAction
                icon={<ArrowRight size={14} />}
                label="Move to..."
                scopes={projectScopes}
                onSelect={(s) => ops.moveTo(artifact, s)}
              />
            </>
          )}
          {showPromote && (
            <ActionButton icon={<ArrowUpCircle size={14} />} label="Promote to Global" onClick={() => ops.promote(artifact)} />
          )}
          {showDemote && (
            <DropdownAction
              icon={<ArrowDownCircle size={14} />}
              label="Demote to Project"
              scopes={projectScopes}
              onSelect={(s) => ops.demoteTo(artifact, s)}
            />
          )}
        </div>
      </div>

      {ops.conflictState && (
        <ConflictDialog
          artifactName={ops.conflictState.artifactName}
          targetProject={ops.conflictState.targetProject}
          onKeep={ops.clearConflict}
          onReplace={async () => {
            await ops.conflictState!.retryFn();
            ops.clearConflict();
          }}
        />
      )}

      {ops.warningState && (
        <WarningDialog
          warnings={ops.warningState.warnings}
          actionLabel={ops.warningState.actionLabel}
          onCancel={ops.clearWarning}
          onConfirm={ops.confirmWarning}
        />
      )}
    </>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-2 h-8 text-sm text-left rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-default"
      onClick={onClick}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DropdownAction({
  icon,
  label,
  scopes,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  scopes: ScopeNode[];
  onSelect: (scope: ScopeNode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? scopes.filter((s) => s.label.toLowerCase().includes(filter.toLowerCase()))
    : scopes;

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 px-2 h-8 text-sm text-left rounded-sm w-full transition-colors cursor-default',
          open ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
        )}
        onClick={() => { setOpen(!open); setFilter(''); }}
      >
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="text-muted-foreground text-xs">{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && (
        <div className="ml-6 mt-1 mb-1 border-l border-border pl-2 flex flex-col gap-0.5">
          <input
            className="h-7 px-2 text-xs bg-background border border-border rounded-sm outline-none focus:ring-1 focus:ring-ring mb-0.5"
            placeholder="Filter projects..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          {filtered.length === 0 ? (
            <span className="text-xs text-muted-foreground px-2 py-1">No matches</span>
          ) : (
            filtered.map((scope) => (
              <button
                key={scope.id}
                type="button"
                className="text-sm text-left px-2 h-7 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors truncate"
                onClick={() => { onSelect(scope); setOpen(false); }}
              >
                {scope.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
