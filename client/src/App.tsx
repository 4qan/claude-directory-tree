import { useState, useCallback, useEffect } from 'react';
import { ArtifactTree } from '@/components/tree/ArtifactTree';
import type { ScanResponse, ArtifactType } from '@/lib/types';

export function App() {
  const [state, setState] = useState<'loading' | 'result' | 'error'>('loading');
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | null>(null);

  const scan = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const res = await fetch('/api/scan');
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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="fixed top-0 left-0 p-6 z-20">
        <h1 className="text-xl font-semibold text-foreground">Claude Directory Tree</h1>
      </header>
      <main className="flex-1 flex flex-col pt-16">
        <ArtifactTree
          scopes={data?.scopes ?? []}
          query={query}
          typeFilter={typeFilter}
          onQueryChange={setQuery}
          onTypeFilterChange={setTypeFilter}
          onRefresh={scan}
          isLoading={state === 'loading'}
          error={state === 'error' ? (error ?? 'Failed to scan directory.') : null}
        />
      </main>
    </div>
  );
}
