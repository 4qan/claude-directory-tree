import { useState, useCallback, useEffect } from 'react';
import { ArtifactTree } from '@/components/tree/ArtifactTree';
import { ArtifactDetailPanel } from '@/components/ArtifactDetailPanel';
import { ToastContainer } from '@/components/Toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ScanResponse, ArtifactType, Artifact } from '@/lib/types';

export function App() {
  const [state, setState] = useState<'loading' | 'result' | 'error'>('loading');
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const scan = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await fetch('/api/scan', { cache: 'no-store' });
      if (!res.ok) throw new Error('scan failed');
      const json = await res.json();
      setData(json);
      setState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan directory.');
      setState('error');
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="px-6 pt-6 pb-2 shrink-0 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Claude Directory Tree</h1>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ArtifactTree
          scopes={data?.scopes ?? []}
          query={query}
          typeFilter={typeFilter}
          onQueryChange={setQuery}
          onTypeFilterChange={setTypeFilter}
          onRefresh={scan}
          isLoading={state === 'loading'}
          error={state === 'error' ? (error ?? 'Failed to scan directory.') : null}
          onSelectedArtifactChange={setSelectedArtifact}
          selectedArtifact={selectedArtifact}
          onCloseDetail={() => setSelectedArtifact(null)}
        />
      </main>
      <ToastContainer />
    </div>
  );
}
