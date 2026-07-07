export function HistogramSkeleton() {
  return (
    <div className="h-[120px] border-b border-border px-4 py-3 flex items-end gap-1 animate-pulse">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-muted"
          style={{ height: `${20 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  )
}

export function LogRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5 animate-pulse">
          <div className="w-12 h-3 rounded bg-muted" />
          <div className="w-28 h-3 rounded bg-muted" />
          <div
            className="flex-1 h-3 rounded bg-muted"
            style={{ maxWidth: `${40 + (i % 5) * 12}%` }}
          />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
        <span className="text-rose-500 text-lg font-mono font-bold">!</span>
      </div>
      <p className="text-sm font-medium text-foreground">Failed to load logs</p>
      <p className="text-xs text-muted-foreground font-mono max-w-sm break-all">{message}</p>
    </div>
  )
}

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-base font-mono">∅</span>
      </div>
      <p className="text-sm font-medium text-foreground">No logs found</p>
      <p className="text-xs text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search query or severity filters.'
          : 'No log records were returned from the API.'}
      </p>
    </div>
  )
}
