import { Bot, Terminal, Zap, Link, FileText, Box, Webhook, BookOpen, FileCode, HelpCircle } from 'lucide-react';
import type { ArtifactType } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

export const ICON_MAP: Record<ArtifactType, LucideIcon> = {
  agent: Bot,
  command: Terminal,
  skill: Zap,
  'mcp-config': Link,
  'claude-md': FileText,
  plugin: Box,
  hook: Webhook,
  memory: BookOpen,
  plan: FileCode,
  unknown: HelpCircle,
};

export const TYPE_LABELS: Record<ArtifactType, string> = {
  agent: 'Agents',
  command: 'Commands',
  skill: 'Skills',
  'mcp-config': 'MCP Servers',
  'claude-md': 'CLAUDE.md',
  plugin: 'Plugins',
  hook: 'Hooks',
  memory: 'Memory',
  plan: 'Plan files',
  unknown: 'Unknown',
};
