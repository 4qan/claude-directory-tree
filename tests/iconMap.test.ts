import { describe, it, expect } from 'vitest';
import { ICON_MAP, TYPE_LABELS } from '../client/src/components/tree/iconMap';
import { ARTIFACT_TYPES } from '../client/src/lib/types';

describe('ICON_MAP', () => {
  it('has exactly 10 keys matching all ArtifactType values', () => {
    const keys = Object.keys(ICON_MAP);
    expect(keys).toHaveLength(10);
    for (const type of ARTIFACT_TYPES) {
      expect(keys).toContain(type);
    }
  });

  it('every value in ICON_MAP is a valid React component (function or forwardRef)', () => {
    for (const [, icon] of Object.entries(ICON_MAP)) {
      // lucide-react v1 exports icons as React.forwardRef objects (typeof === 'object')
      // Both plain functions and forwardRef objects are valid React components
      const isValidComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon);
      expect(isValidComponent).toBe(true);
    }
  });
});

describe('TYPE_LABELS', () => {
  it('has entries for all 10 ArtifactType values', () => {
    const keys = Object.keys(TYPE_LABELS);
    expect(keys).toHaveLength(10);
    for (const type of ARTIFACT_TYPES) {
      expect(keys).toContain(type);
    }
  });

  it("TYPE_LABELS['agent'] === 'Agents'", () => {
    expect(TYPE_LABELS['agent']).toBe('Agents');
  });

  it("TYPE_LABELS['mcp-config'] === 'MCP Servers'", () => {
    expect(TYPE_LABELS['mcp-config']).toBe('MCP Servers');
  });

  it("TYPE_LABELS['claude-md'] === 'CLAUDE.md'", () => {
    expect(TYPE_LABELS['claude-md']).toBe('CLAUDE.md');
  });
});
