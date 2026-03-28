import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ExternalLink,
  Clipboard,
  Copy,
  ArrowRight,
  ArrowUpCircle,
  ArrowDownCircle,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import {
  TYPE_DIR_MAP,
  copyArtifact,
  moveArtifact,
  promoteArtifact,
  demoteArtifact,
  openInEditor,
  resolveCopyPath,
  copyPathToClipboard,
} from '@/lib/operationsApi';
import { showToast } from '@/components/Toast';
import { ConflictDialog } from '@/components/ConflictDialog';
import type { TreeNodeData } from '@/components/tree/TreeItem';
import type { ScopeNode } from '@/lib/types';
import { cn } from '@/lib/utils';

const BLOCKED_TYPES = ['hook', 'mcp-config'];

interface ContextMenuProps {
  x: number;
  y: number;
  nodeKind: 'leaf' | 'scope' | 'category';
  data: TreeNodeData;
  scopes: ScopeNode[];
  onClose: () => void;
  onRefresh: () => void;
}

type ConflictState = {
  artifactName: string;
  targetProject: string;
  retryFn: () => Promise<void>;
};

type FlyoutType = 'copy' | 'move' | 'demote' | null;

export function ContextMenu({
  x,
  y,
  nodeKind,
  data,
  scopes,
  onClose,
  onRefresh,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: y, left: x });
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const [activeFlyout, setActiveFlyout] = useState<FlyoutType>(null);
  const [flyoutFilter, setFlyoutFilter] = useState('');
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  // Project scopes (exclude global for copy/move/demote targets)
  const projectScopes = scopes.filter((s) => s.scope === 'project');
  const filteredProjectScopes =
    flyoutFilter.trim()
      ? projectScopes.filter((s) =>
          s.label.toLowerCase().includes(flyoutFilter.toLowerCase())
        )
      : projectScopes;

  // Viewport edge flipping
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let top = y;
    let left = x;
    if (y + rect.height > window.innerHeight) top = y - rect.height;
    if (x + rect.width > window.innerWidth) left = x - rect.width;
    setMenuPos({ top, left });
  }, [x, y]);

  // Close on click outside and Esc
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleFlyoutItemClick = useCallback(
    async (scope: ScopeNode, action: 'copy' | 'move' | 'demote') => {
      if (data.nodeKind !== 'leaf') return;
      const artifact = data;
      const typeDir = TYPE_DIR_MAP[artifact.type] ?? '';
      const destinationDir = scope.rootPath + (typeDir ? '/' + typeDir : '');

      const execute = async (overwrite = false) => {
        let result;
        if (action === 'copy') {
          result = await copyArtifact(artifact.absolutePath, destinationDir, artifact.type, overwrite);
        } else if (action === 'move') {
          result = await moveArtifact(artifact.absolutePath, destinationDir, artifact.type, overwrite);
        } else {
          result = await demoteArtifact(artifact.absolutePath, scope.rootPath, artifact.type, overwrite);
        }

        if (result.conflict) {
          setConflictState({
            artifactName: artifact.name,
            targetProject: scope.label,
            retryFn: () => execute(true),
          });
          return;
        }

        if (result.success) {
          if (action === 'copy') {
            showToast(`Copied ${artifact.name} to ${scope.label}`);
          } else if (action === 'move') {
            showToast(`Moved ${artifact.name} to ${scope.label}. Claude will see this in the next session.`);
          } else {
            showToast(`Demoted ${artifact.name} to ${scope.label}. Claude will see this in the next session.`);
          }
          if (result.warnings) {
            result.warnings.forEach((w: { type: string; message: string }) => showToast(w.message, 'info', 6000));
          }
          onRefresh();
          onClose();
        } else if (result.error) {
          showToast(`Failed to ${action}: ${result.error}. Check terminal for details.`, 'error', 6000);
          onClose();
        }
      };

      await execute();
    },
    [data, onClose, onRefresh]
  );

  const handlePromote = useCallback(async () => {
    if (data.nodeKind !== 'leaf') return;
    const artifact = data;

    const execute = async (overwrite = false) => {
      const result = await promoteArtifact(artifact.absolutePath, artifact.type, overwrite);

      if (result.conflict) {
        setConflictState({
          artifactName: artifact.name,
          targetProject: 'Global',
          retryFn: () => execute(true),
        });
        return;
      }

      if (result.success) {
        showToast(`Promoted ${artifact.name} to Global. Claude will see this in the next session.`);
        if (result.warnings) {
          result.warnings.forEach((w: { type: string; message: string }) => showToast(w.message, 'info', 6000));
        }
        onRefresh();
        onClose();
      } else if (result.error) {
        showToast(`Failed to promote: ${result.error}. Check terminal for details.`, 'error', 6000);
        onClose();
      }
    };

    await execute();
  }, [data, onClose, onRefresh]);

  const handleCopyPath = useCallback(async () => {
    let resolvedPath: string;

    if (nodeKind === 'category' && data.nodeKind === 'category') {
      // Find parent scope rootPath from the category id (format: "scopeId:type")
      const [scopeId] = data.id.split(':');
      const parentScope = scopes.find((s) => s.id === scopeId);
      const typeDir = TYPE_DIR_MAP[data.type] ?? '';
      resolvedPath = (parentScope?.rootPath ?? '') + (typeDir ? '/' + typeDir : '');
    } else {
      resolvedPath = resolveCopyPath(nodeKind, data as Parameters<typeof resolveCopyPath>[1]);
    }

    await copyPathToClipboard(resolvedPath);
    showToast('Path copied to clipboard');
    onClose();
  }, [nodeKind, data, scopes, onClose]);

  const handleOpenInEditor = useCallback(async () => {
    if (data.nodeKind === 'leaf') {
      await openInEditor(data.absolutePath);
    }
    onClose();
  }, [data, onClose]);

  const handleOpenFolder = useCallback(async () => {
    if (data.nodeKind === 'scope') {
      await openInEditor(data.rootPath);
    }
    onClose();
  }, [data, onClose]);

  const openFlyout = useCallback(
    (type: FlyoutType, triggerEl: HTMLElement) => {
      setActiveFlyout(type);
      setFlyoutFilter('');
      // Flyout positioning: to the right of menu, align with trigger item
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const triggerRect = triggerEl.getBoundingClientRect();
        const flyoutWidth = 200;
        let flyoutLeft = menuRect.right + 2;
        if (flyoutLeft + flyoutWidth > window.innerWidth) {
          flyoutLeft = menuRect.left - flyoutWidth - 2;
        }
        setFlyoutPos({ top: triggerRect.top, left: flyoutLeft });
      }
    },
    []
  );

  const isBlocked = data.nodeKind === 'leaf' && BLOCKED_TYPES.includes(data.type);

  const menuItems = () => {
    if (nodeKind === 'leaf' && data.nodeKind === 'leaf') {
      const showPromote = data.scope === 'project';
      const showDemote = data.scope === 'global';
      return (
        <>
          <MenuItemRow
            icon={<ExternalLink size={14} />}
            label="Open in Editor"
            onClick={handleOpenInEditor}
          />
          <MenuItemRow
            icon={<Clipboard size={14} />}
            label="Copy Path"
            onClick={handleCopyPath}
          />
          <Separator />
          <FlyoutItemRow
            icon={<Copy size={14} />}
            label="Copy to..."
            disabled={isBlocked}
            disabledTooltip="Managed in config file"
            isActive={activeFlyout === 'copy'}
            onHover={(el) => !isBlocked && openFlyout('copy', el)}
            onLeave={() => {}}
          />
          <FlyoutItemRow
            icon={<ArrowRight size={14} />}
            label="Move to..."
            disabled={isBlocked}
            disabledTooltip="Managed in config file"
            isActive={activeFlyout === 'move'}
            onHover={(el) => !isBlocked && openFlyout('move', el)}
            onLeave={() => {}}
          />
          <Separator />
          {showPromote && (
            <MenuItemRow
              icon={<ArrowUpCircle size={14} />}
              label="Promote to Global"
              disabled={isBlocked}
              disabledTooltip="Managed in config file"
              onClick={!isBlocked ? handlePromote : undefined}
            />
          )}
          {showDemote && (
            <FlyoutItemRow
              icon={<ArrowDownCircle size={14} />}
              label="Demote to Project"
              disabled={isBlocked}
              disabledTooltip="Managed in config file"
              isActive={activeFlyout === 'demote'}
              onHover={(el) => !isBlocked && openFlyout('demote', el)}
              onLeave={() => {}}
            />
          )}
        </>
      );
    }

    if (nodeKind === 'scope') {
      return (
        <>
          <MenuItemRow
            icon={<FolderOpen size={14} />}
            label="Open Folder"
            onClick={handleOpenFolder}
          />
          <MenuItemRow
            icon={<Clipboard size={14} />}
            label="Copy Path"
            onClick={handleCopyPath}
          />
        </>
      );
    }

    if (nodeKind === 'category') {
      return (
        <MenuItemRow
          icon={<Clipboard size={14} />}
          label="Copy Path"
          onClick={handleCopyPath}
        />
      );
    }

    return null;
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-40 min-w-[180px] bg-background border border-border rounded-md shadow-lg py-1 text-sm"
        style={{ top: menuPos.top, left: menuPos.left }}
        onMouseLeave={() => setActiveFlyout(null)}
      >
        {menuItems()}
      </div>

      {activeFlyout && (
        <div
          ref={flyoutRef}
          className="fixed z-40 min-w-[180px] max-w-[240px] bg-background border border-border rounded-md shadow-lg py-1 text-sm"
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
        >
          {projectScopes.length > 8 && (
            <div className="px-2 pb-1">
              <input
                className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Filter projects..."
                value={flyoutFilter}
                onChange={(e) => setFlyoutFilter(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {filteredProjectScopes.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No projects</div>
          ) : (
            filteredProjectScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                className="w-full flex items-center px-3 h-8 text-left hover:bg-muted transition-colors"
                onClick={() =>
                  handleFlyoutItemClick(
                    scope,
                    activeFlyout === 'copy'
                      ? 'copy'
                      : activeFlyout === 'move'
                        ? 'move'
                        : 'demote'
                  )
                }
              >
                <span className="truncate">{scope.label}</span>
              </button>
            ))
          )}
        </div>
      )}

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
    </>
  );
}

// Internal helper components

interface MenuItemRowProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
}

function MenuItemRow({ icon, label, onClick, disabled, disabledTooltip }: MenuItemRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-2 px-3 h-8 text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-muted cursor-default'
      )}
      aria-disabled={disabled}
      title={disabled ? disabledTooltip : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface FlyoutItemRowProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledTooltip?: string;
  isActive: boolean;
  onHover: (el: HTMLElement) => void;
  onLeave: () => void;
}

function FlyoutItemRow({
  icon,
  label,
  disabled,
  disabledTooltip,
  isActive,
  onHover,
  onLeave,
}: FlyoutItemRowProps) {
  return (
    <div
      className={cn(
        'w-full flex items-center gap-2 px-3 h-8 transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : isActive
            ? 'bg-muted cursor-default'
            : 'hover:bg-muted cursor-default'
      )}
      aria-disabled={disabled}
      title={disabled ? disabledTooltip : undefined}
      onMouseEnter={(e) => !disabled && onHover(e.currentTarget)}
      onMouseLeave={onLeave}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {!disabled && <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
    </div>
  );
}

function Separator() {
  return <div className="my-1 border-t border-border" />;
}
