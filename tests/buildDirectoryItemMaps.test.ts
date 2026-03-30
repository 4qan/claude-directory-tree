import { describe, it, expect } from 'vitest';
import { buildDirectoryItemMaps } from '../client/src/lib/buildDirectoryItemMaps';
import type { ScopeNode, Artifact } from '../client/src/lib/types';

// Fixtures
const globalScope: ScopeNode = {
  id: 'global',
  label: 'Global (~/.claude)',
  scope: 'global',
  section: 'global',
  rootPath: '/Users/furqan/.claude',
  artifactCount: 2,
  artifacts: [
    {
      id: 'global-cmd-1',
      name: 'my-command.md',
      type: 'command',
      absolutePath: '/Users/furqan/.claude/commands/my-command.md',
      relativePath: 'commands/my-command.md',
      scope: 'global',
      projectId: 'global',
    },
    {
      id: 'global-agent-1',
      name: 'my-agent.md',
      type: 'agent',
      absolutePath: '/Users/furqan/.claude/agents/my-agent.md',
      relativePath: 'agents/my-agent.md',
      scope: 'global',
      projectId: 'global',
    },
  ],
};

const projectAScope: ScopeNode = {
  id: 'proj-a',
  label: 'ProjectA',
  scope: 'project',
  section: 'projects',
  rootPath: '/Users/furqan/Documents/Projects/ProjectA/.claude',
  artifactCount: 3,
  artifacts: [
    {
      id: 'pa-cmd-1',
      name: 'cmd-a.md',
      type: 'command',
      absolutePath: '/Users/furqan/Documents/Projects/ProjectA/.claude/commands/cmd-a.md',
      relativePath: 'commands/cmd-a.md',
      scope: 'project',
      projectId: 'proj-a',
    },
    {
      id: 'pa-agent-1',
      name: 'agent-a.md',
      type: 'agent',
      absolutePath: '/Users/furqan/Documents/Projects/ProjectA/.claude/agents/agent-a.md',
      relativePath: 'agents/agent-a.md',
      scope: 'project',
      projectId: 'proj-a',
    },
    {
      id: 'pa-plugin-1',
      name: 'test-plugin',
      type: 'plugin',
      absolutePath: '/Users/furqan/Documents/Projects/ProjectA/.claude/plugins/test-plugin/plugin.json',
      relativePath: 'plugins/test-plugin/plugin.json',
      scope: 'project',
      projectId: 'proj-a',
      enabled: true,
      children: [
        {
          id: 'pa-plugin-1-child',
          name: 'sub-command.md',
          type: 'command',
          absolutePath: '/Users/furqan/Documents/Projects/ProjectA/.claude/plugins/test-plugin/commands/sub-command.md',
          relativePath: 'plugins/test-plugin/commands/sub-command.md',
          scope: 'project',
          projectId: 'proj-a',
        },
      ],
    },
  ],
};

const projectBScope: ScopeNode = {
  id: 'proj-b',
  label: 'ProjectB',
  scope: 'project',
  section: 'projects',
  rootPath: '/Users/furqan/Documents/Projects/ProjectB/.claude',
  artifactCount: 1,
  artifacts: [
    {
      id: 'pb-cmd-1',
      name: 'cmd-b.md',
      type: 'command',
      absolutePath: '/Users/furqan/Documents/Projects/ProjectB/.claude/commands/cmd-b.md',
      relativePath: 'commands/cmd-b.md',
      scope: 'project',
      projectId: 'proj-b',
    },
  ],
};

describe('buildDirectoryItemMaps', () => {
  // Test 1: Two projects sharing common ancestor produce sibling folder nodes
  it('two projects sharing common ancestor produce sibling folder nodes under that ancestor', () => {
    const { items, children } = buildDirectoryItemMaps([globalScope, projectAScope, projectBScope]);

    // The common ancestor for projects is /Users/furqan/Documents/Projects
    const commonAncestorId = 'dir:/Users/furqan/Documents/Projects';
    expect(items[commonAncestorId]).toBeDefined();
    expect(items[commonAncestorId]?.nodeKind).toBe('folder');

    // Both ProjectA and ProjectB should be children of the common ancestor
    const commonAncestorChildren = children[commonAncestorId];
    expect(commonAncestorChildren).toBeDefined();

    const projectADirId = 'dir:/Users/furqan/Documents/Projects/ProjectA';
    const projectBDirId = 'dir:/Users/furqan/Documents/Projects/ProjectB';
    expect(commonAncestorChildren).toContain(projectADirId);
    expect(commonAncestorChildren).toContain(projectBDirId);
  });

  // Test 2: Global scope is first root child, separate from filesystem trie
  it('global scope is always the first root child, separate from filesystem trie', () => {
    const { items, children } = buildDirectoryItemMaps([globalScope, projectAScope, projectBScope]);

    const rootChildren = children['root'];
    expect(rootChildren).toBeDefined();

    // Global scope should be first
    expect(rootChildren[0]).toBe('global');
    expect(items['global']?.nodeKind).toBe('scope');

    // Global scope should NOT appear inside the filesystem trie
    // i.e. not under /Users/furqan/Documents/Projects
    const commonAncestorId = 'dir:/Users/furqan/Documents/Projects';
    if (children[commonAncestorId]) {
      expect(children[commonAncestorId]).not.toContain('global');
    }
  });

  // Test 3: Non-Claude ancestor directories become nodeKind 'folder' with 'dir:' prefix ids
  it('non-Claude ancestor directories become folder nodes with id pattern dir:/absolute/path', () => {
    const { items } = buildDirectoryItemMaps([globalScope, projectAScope, projectBScope]);

    // These are non-Claude ancestor directories on the path to ProjectA
    const documentsId = 'dir:/Users/furqan/Documents';
    const projectsId = 'dir:/Users/furqan/Documents/Projects';
    const projectAId = 'dir:/Users/furqan/Documents/Projects/ProjectA';

    // At minimum the common ancestor directory and project directories should be folder nodes
    // (some intermediate dirs may be collapsed if only one child)
    expect(items[projectsId]?.nodeKind).toBe('folder');
    expect(items[projectAId]?.nodeKind).toBe('folder');

    // All folder node IDs start with 'dir:'
    const folderIds = Object.keys(items).filter((id) => id.startsWith('dir:'));
    expect(folderIds.length).toBeGreaterThan(0);
    for (const id of folderIds) {
      expect(items[id]?.nodeKind).toBe('folder');
    }
  });

  // Test 4: Artifacts nest under their type directory as folder nodes
  it('artifacts nest under their type directory folder node inside .claude', () => {
    const { items, children } = buildDirectoryItemMaps([globalScope, projectAScope]);

    const claudeDir = 'dir:/Users/furqan/Documents/Projects/ProjectA/.claude';
    const commandsDir = 'dir:/Users/furqan/Documents/Projects/ProjectA/.claude/commands';

    expect(items[claudeDir]?.nodeKind).toBe('folder');
    expect(items[commandsDir]?.nodeKind).toBe('folder');

    // The command artifact should be under commands dir
    const commandsChildren = children[commandsDir];
    expect(commandsChildren).toContain('pa-cmd-1');
    expect(items['pa-cmd-1']?.nodeKind).toBe('leaf');
  });

  // Test 5: Current project scope node has its original ScopeNode data preserved
  it('project scope nodes have their original ScopeNode data preserved for badge rendering', () => {
    const { items } = buildDirectoryItemMaps([globalScope, projectAScope]);

    // The scope node for projectAScope should still be accessible
    expect(items['proj-a']).toBeDefined();
    expect(items['proj-a']?.nodeKind).toBe('scope');
    const scopeNode = items['proj-a'] as (ScopeNode & { nodeKind: 'scope' });
    expect(scopeNode.label).toBe('ProjectA');
    expect(scopeNode.rootPath).toBe('/Users/furqan/Documents/Projects/ProjectA/.claude');
    expect(scopeNode.artifacts).toBeDefined();
  });

  // Test 6: Empty scopes are excluded
  it('empty scopes produce no folder nodes in the tree', () => {
    const emptyScope: ScopeNode = {
      id: 'proj-empty',
      label: 'EmptyProject',
      scope: 'project',
      section: 'projects',
      rootPath: '/Users/furqan/Documents/Projects/EmptyProject/.claude',
      artifactCount: 0,
      artifacts: [],
    };

    const { items, children } = buildDirectoryItemMaps([globalScope, emptyScope]);

    // No folder nodes for the empty project
    const emptyProjectDir = 'dir:/Users/furqan/Documents/Projects/EmptyProject';
    expect(items[emptyProjectDir]).toBeUndefined();

    // No scope node for the empty project in the tree
    const rootChildren = children['root'];
    // Root should not directly contain the empty scope
    expect(rootChildren).not.toContain('proj-empty');
  });

  // Test 7: Plugin artifacts with children are indexed correctly
  it('plugin artifacts with children are indexed correctly in the items map', () => {
    const { items, children } = buildDirectoryItemMaps([globalScope, projectAScope]);

    // The plugin node should be in items
    expect(items['pa-plugin-1']).toBeDefined();
    expect(items['pa-plugin-1']?.nodeKind).toBe('leaf');

    // Plugin children should also be indexed
    expect(items['pa-plugin-1-child']).toBeDefined();
    expect(items['pa-plugin-1-child']?.nodeKind).toBe('leaf');

    // Plugin should have children registered
    expect(children['pa-plugin-1']).toBeDefined();
    expect(children['pa-plugin-1']).toContain('pa-plugin-1-child');
  });

  // Test 8: Single project produces no unnecessary parent folders (starts at project directory)
  it('single project starts tree at project directory without unnecessary parent nesting', () => {
    const singleProjectScope: ScopeNode = {
      id: 'proj-solo',
      label: 'SoloProject',
      scope: 'project',
      section: 'current',
      rootPath: '/Users/furqan/Work/SoloProject/.claude',
      artifactCount: 1,
      artifacts: [
        {
          id: 'solo-cmd-1',
          name: 'solo-command.md',
          type: 'command',
          absolutePath: '/Users/furqan/Work/SoloProject/.claude/commands/solo-command.md',
          relativePath: 'commands/solo-command.md',
          scope: 'project',
          projectId: 'proj-solo',
        },
      ],
    };

    const { items, children } = buildDirectoryItemMaps([singleProjectScope]);

    // With a single project, there's no common ancestor to merge under
    // The root non-global child should be the project directory itself (or minimal path)
    const rootChildren = children['root'];
    // Should not start from root '/' for a single project
    expect(rootChildren).not.toContain('dir:/');
    expect(rootChildren).not.toContain('dir:');

    // The project directory should be directly accessible
    const soloProjectDir = 'dir:/Users/furqan/Work/SoloProject';
    // Either the project dir is directly under root, or there's minimal nesting
    // (implementation may start at Work or SoloProject level for single project)
    expect(items[soloProjectDir]).toBeDefined();
  });
});
