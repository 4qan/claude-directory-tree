// RED phase: unskip and complete in Plan 02-03 Task 1
// These tests require ArtifactTree to be wired into App.tsx with real data.
// Plan 02-03 completes the integration and makes these tests pass.

import type { ScopeNode } from '../client/src/lib/types';

// --- Fixtures ---

const globalScope: ScopeNode = {
  id: 'global',
  label: 'Global',
  scope: 'global',
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

// --- Tests ---

describe('ArtifactTree', () => {
  // TREE-01: tree structure
  it.skip('renders scope labels in tree hierarchy', () => {
    // Assert that "Global" and "my-app" scope labels are visible in the rendered tree
  });

  // TREE-03: scope badges
  it.skip('renders scope badges with global/project text', () => {
    // Assert that scope badge text "global" appears next to the Global scope node
    // and "project" appears next to the my-app scope node
  });

  // TREE-04: artifact count
  it.skip('renders category nodes with artifact count', () => {
    // Assert that "Agents (2)" and "Commands (1)" appear after expanding the Global scope
  });

  // TREE-06: refresh
  it.skip('refresh button triggers onRefresh callback', () => {
    // Assert that clicking the refresh button calls the onRefresh prop once
  });

  // Loading state
  it.skip('shows skeleton when loading with empty scopes', () => {
    // Assert that when isLoading=true and scopes=[], TreeSkeleton (animate-pulse) is rendered
  });

  // Error state
  it.skip('shows error message with retry button', () => {
    // Assert that when error="scan failed", "Could not load artifacts" heading is shown
    // and clicking "Try again" calls onRefresh
  });
});
