import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ScanResponse {
  scannedAt: string;
  targetDir: string;
  scopes: Array<{
    id: string;
    label: string;
    scope: 'global' | 'project';
    rootPath: string;
    artifacts: unknown[];
    artifactCount: number;
  }>;
  totalArtifacts: number;
}

export function App() {
  const [state, setState] = useState<'loading' | 'result' | 'error'>('loading');
  const [data, setData] = useState<ScanResponse | null>(null);

  const scan = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/scan');
      if (!res.ok) throw new Error('scan failed');
      const json = await res.json();
      setData(json);
      setState('result');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <header className="fixed top-0 left-0 p-6">
        <h1 className="text-xl font-semibold text-foreground">Claude Directory Tree</h1>
      </header>
      <Card className="w-full max-w-[480px]">
        <CardContent className="p-6">
          {state === 'loading' && (
            <>
              <h2 className="text-xl font-semibold mb-4">Scanning...</h2>
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Scanning...
              </Button>
            </>
          )}
          {state === 'result' && data && (
            <>
              <h2 className="text-xl font-semibold mb-2">Scan complete.</h2>
              <p className="text-base mb-4">
                {data.totalArtifacts} artifacts found across {data.scopes.length} projects.
              </p>
              <Button onClick={scan} className="w-full">Rescan</Button>
            </>
          )}
          {state === 'error' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Scan failed.</h2>
              <p className="text-base mb-4">
                Could not read your projects directory. Check that the path exists and try again.
              </p>
              <Button onClick={scan} className="w-full">Rescan</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
