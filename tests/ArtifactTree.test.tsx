// @vitest-environment happy-dom
// RED phase: unskip and complete in Plan 02-03 Task 1
// These tests require ArtifactTree to be wired into App.tsx with real data.
// Plan 02-03 completes the integration and makes these tests pass.

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArtifactTree } from '../client/src/components/tree/ArtifactTree';
import type { ScopeNode } from '../client/src/lib/types';

// --- Fixtures ---

const globalScope: ScopeNode = {
  id: 'global',
  label: 'Global',
  scope: 'global',
  section: 'global',
  rootPath: '/Users/test/.claude',
  artifactCount: 3,
  artifacts: [
    {
      id: 'agent-1',
      name: 'my-agent',
      type: 'agent',
      absolutePath: '/Users/test/.claude/agents/my-agent.md',
      relativePath: 'agents/my-agent.md',
      scope: 'global',
      projectId: 'global',
    },
    {
      id: 'agent-2',
      name: 'another-agent',
      type: 'agent',
      absolutePath: '/Users/test/.claude/agents/another-agent.md',
      relativePath: 'agents/another-agent.md',
      scope: 'global',
      projectId: 'global',
    },
    {
      id: 'command-1',
      name: 'my-cmd',
      type: 'command',
      absolutePath: '/Users/test/.claude/commands/my-cmd.md',
      relativePath: 'commands/my-cmd.md',
      scope: 'global',
      projectId: 'global',
    },
  ],
};

const projectScope: ScopeNode = {
  id: 'project-my-app',
  label: 'my-app',
  scope: 'project',
  section: 'projects',
  rootPath: '/Users/test/projects/my-app',
  artifactCount: 1,
  artifacts: [
    {
      id: 'skill-1',
      name: 'my-skill',
      type: 'skill',
      absolutePath: '/Users/test/projects/my-app/.claude/skills/my-skill/SKILL.md',
      relativePath: '.claude/skills/my-skill/SKILL.md',
      scope: 'project',
      projectId: 'project-my-app',
    },
  ],
};

const mockScopes: ScopeNode[] = [globalScope, projectScope];

const defaultProps = {
  query: '',
  typeFilter: null,
  onQueryChange: () => {},
  onTypeFilterChange: () => {},
  onRefresh: () => {},
  isLoading: false,
  error: null,
};

// --- Tests ---

describe('ArtifactTree', () => {
  // TREE-01: tree structure
  it('renders scope labels in tree hierarchy', () => {
    render(<ArtifactTree {...defaultProps} scopes={mockScopes} />);
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
  });

  // TREE-03: scope nodes render without badges (badges removed, position conveys scope)
  it('renders scope labels without scope badges', () => {
    render(<ArtifactTree {...defaultProps} scopes={mockScopes} />);
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    // Scope badges were removed — "global" and "project" text should not appear
    expect(screen.queryByText('global')).not.toBeInTheDocument();
    expect(screen.queryByText('project')).not.toBeInTheDocument();
  });

  // TREE-04: artifact count visible after expanding scope
  it('renders category nodes with artifact count after expanding', () => {
    render(<ArtifactTree {...defaultProps} scopes={mockScopes} />);
    // Tree starts collapsed. Click "Expand all" to reveal categories.
    fireEvent.click(screen.getByText('Expand all'));
    // The category for agents should show "(2)" count
    const agentsLabels = screen.getAllByText('Agents');
    expect(agentsLabels.length).toBeGreaterThan(0);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  // TREE-06: refresh
  it('refresh button triggers onRefresh callback', () => {
    const onRefresh = vi.fn();
    render(<ArtifactTree {...defaultProps} scopes={mockScopes} onRefresh={onRefresh} />);
    const refreshButton = screen.getByRole('button', { name: 'Refresh artifact tree' });
    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // Loading state
  it('shows skeleton when loading with empty scopes', () => {
    render(<ArtifactTree {...defaultProps} scopes={[]} isLoading={true} />);
    expect(screen.getByRole('status', { name: 'Loading artifacts...' })).toBeInTheDocument();
  });

  // Error state
  it('shows error message with retry button', () => {
    const onRefresh = vi.fn();
    render(<ArtifactTree {...defaultProps} scopes={[]} error="scan failed" onRefresh={onRefresh} />);
    expect(screen.getByText('Could not load artifacts')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retryButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
