import type { ScopeNode, ArtifactType, Artifact } from './types';

export function deriveVisibleTree(
  scopes: ScopeNode[],
  query: string,
  typeFilter: ArtifactType | null
): ScopeNode[] {
  const q = query.trim().toLowerCase();

  return scopes
    .map((scope) => {
      const filtered = filterArtifacts(scope.artifacts, q, typeFilter);
      return { ...scope, artifacts: filtered, artifactCount: countAll(filtered) };
    })
    .filter((scope) => scope.artifactCount > 0);
}

function filterArtifacts(
  artifacts: Artifact[],
  q: string,
  typeFilter: ArtifactType | null
): Artifact[] {
  return artifacts.flatMap((artifact) => {
    const children = artifact.children && artifact.children.length > 0
      ? filterArtifacts(artifact.children, q, typeFilter)
      : undefined;

    // Parent node with surviving children: keep it
    if (children && children.length > 0) {
      return [{ ...artifact, children }];
    }

    // Parent node with no surviving children: drop it
    if (children && children.length === 0) {
      return [];
    }

    // Leaf artifact: apply both filters (AND logic)
    const nameMatch = !q || artifact.name.toLowerCase().includes(q);
    const typeMatch = !typeFilter || artifact.type === typeFilter;
    return nameMatch && typeMatch ? [artifact] : [];
  });
}

function countAll(artifacts: Artifact[]): number {
  return artifacts.reduce((sum, a) => {
    if (a.children) return sum + countAll(a.children);
    return sum + 1;
  }, 0);
}
