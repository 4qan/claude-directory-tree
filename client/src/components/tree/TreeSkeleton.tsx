export function TreeSkeleton() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading artifacts...">
      <div className="sr-only" aria-live="polite">Loading artifacts...</div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-5 bg-muted rounded w-32 mb-2" />
          {[1, 2].map((j) => (
            <div key={j} className="ml-4 h-4 bg-muted rounded w-48 mb-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
