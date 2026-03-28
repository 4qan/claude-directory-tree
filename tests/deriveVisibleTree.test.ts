import { describe, it, expect } from 'vitest';
import { deriveVisibleTree } from '../client/src/lib/deriveVisibleTree';
import type { ScopeNode, Artifact } from '../client/src/lib/types';

// Test fixtures
const globalAgent: Artifact = {
  id: 'a1',
  name: 'my-agent',
  type: 'agent',
  absolutePath: '/global/.claude/agents/my-agent.md',
  relativePath: 'agents/my-agent.md',
  scope: 'global',
  projectId: '__global__',
};

const globalCommand: Artifact = {
  id: 'a2',
  name: 'deploy',
  type: 'command',
  absolutePath: '/global/.claude/commands/deploy.md',
  relativePath: 'commands/deploy.md',
  scope: 'global',
  projectId: '__global__',
};

const globalBotAgent: Artifact = {
  id: 'a3',
  name: 'bot-assistant',
  type: 'agent',
  absolutePath: '/global/.claude/agents/bot-assistant.md',
  relativePath: 'agents/bot-assistant.md',
  scope: 'global',
  projectId: '__global__',
};

const pluginChild1: Artifact = {
  id: 'p-child-1',
  name: 'tree-command',
  type: 'command',
  absolutePath: '/global/.claude/plugins/my-plugin/tree.md',
  relativePath: 'plugins/my-plugin/tree.md',
  scope: 'global',
  projectId: '__global__',
};

const pluginWithChildren: Artifact = {
  id: 'plugin-1',
  name: 'my-plugin',
  type: 'plugin',
  absolutePath: '/global/.claude/plugins/my-plugin',
  relativePath: 'plugins/my-plugin',
  scope: 'global',
  projectId: '__global__',
  children: [pluginChild1],
};

const projectSkill: Artifact = {
  id: 'b1',
  name: 'refactor-skill',
  type: 'skill',
  absolutePath: '/project/.agents/skills/refactor-skill.md',
  relativePath: 'skills/refactor-skill.md',
  scope: 'project',
  projectId: 'my-project',
};

const globalScope: ScopeNode = {
  id: 'global',
  label: 'Global',
  scope: 'global',
  rootPath: '/global/.claude',
  artifacts: [globalAgent, globalCommand, globalBotAgent, pluginWithChildren],
  artifactCount: 5, // 3 leaf + 1 plugin container + 1 plugin child
};

const projectScope: ScopeNode = {
  id: 'project',
  label: 'My Project',
  scope: 'project',
  rootPath: '/project',
  artifacts: [projectSkill],
  artifactCount: 1,
};

const scopes: ScopeNode[] = [globalScope, projectScope];

describe('deriveVisibleTree', () => {
  it('no filters: returns all scopes with all artifacts unchanged', () => {
    const result = deriveVisibleTree(scopes, '', null);
    expect(result).toHaveLength(2);
    expect(result[0].artifacts).toHaveLength(globalScope.artifacts.length);
    expect(result[1].artifacts).toHaveLength(1);
  });

  it('name filter: returns only artifacts whose name contains the query (case-insensitive)', () => {
    const result = deriveVisibleTree(scopes, 'my-agent', null);
    // Only globalAgent matches 'my-agent'
    expect(result).toHaveLength(1);
    expect(result[0].artifacts).toHaveLength(1);
    expect(result[0].artifacts[0].name).toBe('my-agent');
  });

  it('type filter: returns only artifacts with specified type', () => {
    const result = deriveVisibleTree(scopes, '', 'agent');
    // globalAgent and globalBotAgent match; projectSkill and command do not
    expect(result).toHaveLength(1);
    const agents = result[0].artifacts;
    expect(agents).toHaveLength(2);
    expect(agents.every((a) => a.type === 'agent')).toBe(true);
  });

  it('AND logic: applies both name and type filters together', () => {
    const result = deriveVisibleTree(scopes, 'bot', 'agent');
    expect(result).toHaveLength(1);
    expect(result[0].artifacts).toHaveLength(1);
    expect(result[0].artifacts[0].name).toBe('bot-assistant');
  });

  it('empty scopes removed: scope with 0 artifacts after filter is excluded', () => {
    // Filter for 'skill' type — only projectScope has skills
    const result = deriveVisibleTree(scopes, '', 'skill');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('project');
  });

  it('empty categories removed: plugin with no surviving children is excluded', () => {
    // Filter by name 'deploy' — deploy command is at leaf level, plugin children won't match
    const result = deriveVisibleTree(scopes, 'deploy', null);
    expect(result).toHaveLength(1);
    const artifacts = result[0].artifacts;
    // Only the 'deploy' command should be present; plugin should be removed (child 'tree-command' doesn't match)
    expect(artifacts.find((a) => a.name === 'deploy')).toBeDefined();
    expect(artifacts.find((a) => a.type === 'plugin')).toBeUndefined();
  });

  it('plugin nesting: plugin preserved if any child matches, even if plugin name does not', () => {
    // Search 'tree-command' — matches child of plugin, not the plugin itself
    const result = deriveVisibleTree(scopes, 'tree-command', null);
    expect(result).toHaveLength(1);
    const plugin = result[0].artifacts.find((a) => a.type === 'plugin');
    expect(plugin).toBeDefined();
    expect(plugin!.children).toHaveLength(1);
    expect(plugin!.children![0].name).toBe('tree-command');
  });

  it('artifactCount updated: returned ScopeNode.artifactCount reflects filtered count', () => {
    const result = deriveVisibleTree(scopes, '', 'agent');
    expect(result[0].artifactCount).toBe(2);
  });

  it('case insensitive: MY-AGENT matches my-agent', () => {
    const result = deriveVisibleTree(scopes, 'MY-AGENT', null);
    expect(result).toHaveLength(1);
    expect(result[0].artifacts[0].name).toBe('my-agent');
  });
});
