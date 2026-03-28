// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ContextMenu } from '../client/src/components/ContextMenu';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock operationsApi
vi.mock('../client/src/lib/operationsApi', () => ({
  TYPE_DIR_MAP: { command: 'commands', agent: 'agents', skill: 'skills' },
  openInEditor: vi.fn().mockResolvedValue({ success: true }),
  copyArtifact: vi.fn().mockResolvedValue({ success: true }),
  moveArtifact: vi.fn().mockResolvedValue({ success: true }),
  promoteArtifact: vi.fn().mockResolvedValue({ success: true }),
  demoteArtifact: vi.fn().mockResolvedValue({ success: true }),
  resolveCopyPath: vi.fn().mockReturnValue('/mock/path'),
  copyPathToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../client/src/components/Toast', () => ({
  showToast: vi.fn(),
}));

const mockScopes = [
  { id: 'global', label: 'Global', scope: 'global' as const, rootPath: '/home/.claude', artifacts: [], artifactCount: 0, section: 'global' },
  { id: 'proj1', label: 'my-project', scope: 'project' as const, rootPath: '/projects/my-project/.claude', artifacts: [], artifactCount: 0, section: 'projects' },
];

const mockLeafData = {
  nodeKind: 'leaf' as const,
  id: 'test-cmd',
  name: 'test-command',
  type: 'command' as const,
  absolutePath: '/home/.claude/commands/test-command.md',
  scope: 'global' as const,
  projectId: 'global',
  relativePath: 'commands/test-command.md',
};

const mockLeafProjectData = {
  nodeKind: 'leaf' as const,
  id: 'proj-cmd',
  name: 'project-command',
  type: 'command' as const,
  absolutePath: '/projects/my-project/.claude/commands/project-command.md',
  scope: 'project' as const,
  projectId: 'proj1',
  relativePath: 'commands/project-command.md',
};

const mockScopeData = {
  nodeKind: 'scope' as const,
  id: 'global',
  label: 'Global',
  scope: 'global' as const,
  rootPath: '/home/.claude',
  artifacts: [],
  artifactCount: 0,
  section: 'global',
};

const mockCategoryData = {
  nodeKind: 'category' as const,
  id: 'global:command',
  type: 'command' as const,
  label: 'Commands',
  children: [],
  count: 2,
};

describe('ContextMenu', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    scopes: mockScopes as any,
    onClose: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders leaf menu with Open, Copy Path, Copy to, Move to, and Demote for global scope', () => {
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafData as any} />);
    expect(screen.getByText('Open in Editor')).toBeInTheDocument();
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
    expect(screen.getByText(/Copy to/)).toBeInTheDocument();
    expect(screen.getByText(/Move to/)).toBeInTheDocument();
    expect(screen.getByText('Demote to Project')).toBeInTheDocument();
  });

  it('renders leaf menu with Promote to Global for project-scoped artifacts', () => {
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafProjectData as any} />);
    expect(screen.getByText('Promote to Global')).toBeInTheDocument();
    expect(screen.queryByText('Demote to Project')).not.toBeInTheDocument();
  });

  it('renders scope menu with Open Folder and Copy Path only', () => {
    render(<ContextMenu {...defaultProps} nodeKind="scope" data={mockScopeData as any} />);
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
    expect(screen.queryByText(/Copy to/)).not.toBeInTheDocument();
    expect(screen.queryByText('Open in Editor')).not.toBeInTheDocument();
  });

  it('renders category menu with Copy Path only', () => {
    render(<ContextMenu {...defaultProps} nodeKind="category" data={mockCategoryData as any} />);
    expect(screen.getByText('Copy Path')).toBeInTheDocument();
    expect(screen.queryByText('Open in Editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Folder')).not.toBeInTheDocument();
    expect(screen.queryByText(/Copy to/)).not.toBeInTheDocument();
  });

  it('disables copy/move for blocked types (hook)', () => {
    const hookData = { ...mockLeafData, type: 'hook' as const };
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={hookData as any} />);
    const copyTo = screen.getByText(/Copy to/);
    expect(copyTo.closest('[aria-disabled="true"]') || copyTo.closest('.opacity-50')).toBeTruthy();
  });

  it('calls copyPathToClipboard when Copy Path clicked', async () => {
    const { copyPathToClipboard } = await import('../client/src/lib/operationsApi');
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafData as any} />);
    await userEvent.click(screen.getByText('Copy Path'));
    expect(copyPathToClipboard).toHaveBeenCalled();
  });

  it('closes menu on Esc key', () => {
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafData as any} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls openInEditor and onClose when Open in Editor clicked', async () => {
    const { openInEditor } = await import('../client/src/lib/operationsApi');
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafData as any} />);
    await userEvent.click(screen.getByText('Open in Editor'));
    expect(openInEditor).toHaveBeenCalledWith(mockLeafData.absolutePath);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls promoteArtifact and onRefresh after successful promote', async () => {
    const { promoteArtifact } = await import('../client/src/lib/operationsApi');
    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafProjectData as any} />);
    await userEvent.click(screen.getByText('Promote to Global'));
    expect(promoteArtifact).toHaveBeenCalledWith(
      mockLeafProjectData.absolutePath,
      mockLeafProjectData.type,
      false
    );
    await waitFor(() => expect(defaultProps.onRefresh).toHaveBeenCalled());
  });

  it('shows conflict dialog when operation returns conflict:true', async () => {
    const { copyArtifact: mockCopyFn } = await import('../client/src/lib/operationsApi');
    vi.mocked(mockCopyFn).mockResolvedValueOnce({ success: false, conflict: true });

    render(<ContextMenu {...defaultProps} nodeKind="leaf" data={mockLeafData as any} />);

    // Hover over Copy to... to open flyout
    const copyToItem = screen.getByText(/Copy to/);
    fireEvent.mouseEnter(copyToItem.closest('[aria-disabled]') ?? copyToItem.parentElement!);

    // Click a project in the flyout
    await waitFor(() => {
      expect(screen.queryByText('my-project')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('my-project'));

    await waitFor(() => {
      expect(screen.getByText('File already exists')).toBeInTheDocument();
    });
  });
});
