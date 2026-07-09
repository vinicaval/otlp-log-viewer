import type { ViewMode } from './log-toolbar'

interface LogHeaderProps {
  brushRange: [number, number] | null
  onClearBrushRange: () => void
  viewMode: ViewMode
}

export function LogHeader({ brushRange, onClearBrushRange, viewMode }: LogHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-semibold text-foreground tracking-tight">
          otlp-log-viewer
        </span>
        {brushRange && (
          <button
            onClick={onClearBrushRange}
            className="text-[11px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 hover:text-foreground hover:border-foreground/30 transition-colors"
            aria-label="Clear time range filter"
          >
            time range ×
          </button>
        )}
      </div>
      <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
        press <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">/</kbd> to search
        {viewMode === 'flat' && (
          <>
            &nbsp;·&nbsp;
            <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">j</kbd>
            <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">k</kbd> to navigate
            &nbsp;·&nbsp;
            <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">↵</kbd> to expand
          </>
        )}
      </span>
    </header>
  )
}
