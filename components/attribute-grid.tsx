'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface AttributeGridProps {
  title: string
  attrs: Record<string, string>
  defaultOpen?: boolean
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1 rounded p-0.5 opacity-0 group-hover/attr:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity"
      aria-label={`Copy value: ${value}`}
    >
      {copied ? (
        <Check size={11} className="text-emerald-500" />
      ) : (
        <Copy size={11} className="text-muted-foreground" />
      )}
    </button>
  )
}

export function AttributeGrid({ title, attrs, defaultOpen = true }: AttributeGridProps) {
  const [open, setOpen] = useState(defaultOpen)
  const entries = Object.entries(attrs)

  if (entries.length === 0) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-1.5"
      >
        <span
          className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▶
        </span>
        {title}
        <span className="font-normal normal-case tracking-normal">
          ({entries.length})
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
          {entries.map(([key, val]) => (
            <div key={key} className="contents group/attr">
              <dt className="font-mono text-[12px] text-muted-foreground py-0.5 whitespace-nowrap select-all">
                {key}
              </dt>
              <dd className="font-mono text-[12px] text-foreground py-0.5 flex items-start min-w-0">
                <span className="break-all select-all leading-relaxed">{val}</span>
                <CopyButton value={val} />
              </dd>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
