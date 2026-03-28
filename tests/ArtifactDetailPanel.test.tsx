// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ArtifactDetailPanel } from '../client/src/components/ArtifactDetailPanel';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock operationsApi
vi.mock('../client/src/lib/operationsApi', () => ({
  describeArtifact: vi.fn().mockResolvedValue({ description: 'Mock description' }),
}));

const mockArtifact = {
  id: 'test-1',
  name: 'test-command',
  type: 'command' as const,
  absolutePath: '/home/user/.claude/commands/test-command.md',
  relativePath: 'commands/test-command.md',
  scope: 'global' as const,
  projectId: 'global',
};

describe('ArtifactDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when artifact is null', () => {
    const { container } = render(<ArtifactDetailPanel artifact={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders artifact name, type, scope, and path', () => {
    render(<ArtifactDetailPanel artifact={mockArtifact} onClose={vi.fn()} />);
    expect(screen.getByText('test-command')).toBeInTheDocument();
    expect(screen.getByText(mockArtifact.absolutePath)).toBeInTheDocument();
  });

  it('shows frontmatter description when available', () => {
    const withDesc = { ...mockArtifact, frontmatter: { description: 'A test command' } };
    render(<ArtifactDetailPanel artifact={withDesc} onClose={vi.fn()} />);
    expect(screen.getByText('A test command')).toBeInTheDocument();
  });

  it('fetches description from server when no frontmatter', async () => {
    render(<ArtifactDetailPanel artifact={mockArtifact} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Mock description')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<ArtifactDetailPanel artifact={mockArtifact} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Close detail panel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows "No description available." when description is null', async () => {
    const { describeArtifact } = await import('../client/src/lib/operationsApi');
    (describeArtifact as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ description: null });
    render(<ArtifactDetailPanel artifact={mockArtifact} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('No description available.')).toBeInTheDocument();
    });
  });
});
