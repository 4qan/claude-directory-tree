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
} from 'lucide-react';
import { ICON_MAP, TYPE_LABELS, TYPE_LABELS_SINGULAR } from '@/components/tree/iconMap';
import { cn } from '@/lib/utils';
import {
  describeArtifact,
  openInEditor,
  copyPathToClipboard,
  copyArtifact,
  moveArtifact,
  promoteArtifact,
  demoteArtifact,
  preflightCheck,
  TYPE_DIR_MAP,
} from '@/lib/operationsApi';
import { showToast } from '@/components/Toast';
import { ConflictDialog } from '@/components/ConflictDialog';
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
  const [conflictState, setConflictState] = useState<{
    artifactName: string;
    targetProject: string;
    retryFn: () => Promise<void>;
  } | null>(null);
  const [warningState, setWarningState] = useState<{
    warnings: { type: string; message: string }[];
    actionLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

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

  // Run preflight check before any operation. If warnings exist, show confirmation dialog.
  // If no warnings, execute immediately.
  const withPreflight = async (actionLabel: string, execute: () => Promise<void>) => {
    const { warnings } = await preflightCheck(artifact.absolutePath, artifact.type);
    if (warnings.length > 0) {
      setWarningState({ warnings, actionLabel, onConfirm: execute });
    } else {
      await execute();
    }
  };

  const handleCopyPath = async () => {
    await copyPathToClipboard(artifact.absolutePath);
    showToast('Path copied to clipboard');
  };

  const handleOpenInEditor = async () => {
    await openInEditor(artifact.absolutePath);
  };

  const handleRevealInFinder = async () => {
    // For directory types, open the directory; for files, open the parent
    const dirPath = ['skill', 'plugin'].includes(artifact.type)
      ? artifact.absolutePath.substring(0, artifact.absolutePath.lastIndexOf('/'))
      : artifact.absolutePath.substring(0, artifact.absolutePath.lastIndexOf('/'));
    await openInEditor(dirPath);
  };

  const executeCopy = async (scope: ScopeNode, overwrite = false) => {
    const typeDir = TYPE_DIR_MAP[artifact.type] ?? '';
    const destDir = scope.rootPath + (typeDir ? '/' + typeDir : '');
    const result = await copyArtifact(artifact.absolutePath, destDir, artifact.type, overwrite);
    if (result.conflict) {
      setConflictState({
        artifactName: artifact.name,
        targetProject: scope.label,
        retryFn: () => executeCopy(scope, true),
      });
    } else if (result.success) {
      showToast(`Copied the ${typeLabel} "${artifact.name}" to ${scope.label}`);
      onRefresh();
    } else if (result.error) {
      showToast(`Failed: ${result.error}`, 'error', 6000);
    }
  };

  const handleCopyTo = (scope: ScopeNode) => {
    withPreflight(`Copy to ${scope.label}`, () => executeCopy(scope));
  };

  const executeMove = async (scope: ScopeNode, overwrite = false) => {
    const typeDir = TYPE_DIR_MAP[artifact.type] ?? '';
    const destDir = scope.rootPath + (typeDir ? '/' + typeDir : '');
    const result = await moveArtifact(artifact.absolutePath, destDir, artifact.type, overwrite);
    if (result.conflict) {
      setConflictState({
        artifactName: artifact.name,
        targetProject: scope.label,
        retryFn: () => executeMove(scope, true),
      });
    } else if (result.success) {
      showToast(`Moved the ${typeLabel} "${artifact.name}" to ${scope.label}`);
      onRefresh();
      onClose();
    } else if (result.error) {
      showToast(`Failed: ${result.error}`, 'error', 6000);
    }
  };

  const handleMoveTo = (scope: ScopeNode) => {
    withPreflight(`Move to ${scope.label}`, () => executeMove(scope));
  };

  const executePromote = async (overwrite = false) => {
    const result = await promoteArtifact(artifact.absolutePath, artifact.type, overwrite);
    if (result.conflict) {
      setConflictState({
        artifactName: artifact.name,
        targetProject: 'Global',
        retryFn: () => executePromote(true),
      });
    } else if (result.success) {
      showToast(`Promoted the ${typeLabel} "${artifact.name}" to Global`);
      onRefresh();
      onClose();
    } else if (result.error) {
      showToast(`Failed: ${result.error}`, 'error', 6000);
    }
  };

  const handlePromote = () => {
    withPreflight('Promote to Global', () => executePromote());
  };

  const executeDemote = async (scope: ScopeNode, overwrite = false) => {
    const result = await demoteArtifact(artifact.absolutePath, scope.rootPath, artifact.type, overwrite);
    if (result.conflict) {
      setConflictState({
        artifactName: artifact.name,
        targetProject: scope.label,
        retryFn: () => executeDemote(scope, true),
      });
    } else if (result.success) {
      showToast(`Demoted the ${typeLabel} "${artifact.name}" to ${scope.label}`);
      onRefresh();
      onClose();
    } else if (result.error) {
      showToast(`Failed: ${result.error}`, 'error', 6000);
    }
  };

  const handleDemote = (scope: ScopeNode) => {
    withPreflight(`Demote to ${scope.label}`, () => executeDemote(scope));
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
          {showCopyMove && (
            <>
              <DropdownAction
                icon={<Copy size={14} />}
                label="Copy to..."
                scopes={projectScopes}
                onSelect={(s) => handleCopyTo(s)}
              />
              <DropdownAction
                icon={<ArrowRight size={14} />}
                label="Move to..."
                scopes={projectScopes}
                onSelect={(s) => handleMoveTo(s)}
              />
            </>
          )}
          {showPromote && (
            <ActionButton icon={<ArrowUpCircle size={14} />} label="Promote to Global" onClick={handlePromote} />
          )}
          {showDemote && (
            <DropdownAction
              icon={<ArrowDownCircle size={14} />}
              label="Demote to Project"
              scopes={projectScopes}
              onSelect={(s) => handleDemote(s)}
            />
          )}
        </div>
      </div>

      {conflictState && (
        <ConflictDialog
          artifactName={conflictState.artifactName}
          targetProject={conflictState.targetProject}
          onKeep={() => setConflictState(null)}
          onReplace={async () => {
            await conflictState.retryFn();
            setConflictState(null);
          }}
        />
      )}

      {warningState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-popover rounded-lg border border-border shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">References detected</h3>
            <p className="text-sm text-muted-foreground mb-3">
              This artifact contains references that may not resolve correctly in the destination:
            </p>
            <ul className="text-sm text-muted-foreground mb-4 space-y-1.5">
              {warningState.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-500 shrink-0">&#9888;</span>
                  <span className="font-mono text-xs break-all">{w.message}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setWarningState(null)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  const fn = warningState.onConfirm;
                  setWarningState(null);
                  await fn();
                }}
              >
                {warningState.actionLabel} anyway
              </Button>
            </div>
          </div>
        </div>
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
