'use client'

import { useState } from 'react'
import { Copy, Check, ChevronRight, Clock, Server, FileText, Tag, Layers, AlertTriangle } from 'lucide-react'
import type { FlatLogRecord } from '@/lib/otlp-types'
import { formatAbsoluteTime } from '@/lib/otlp-utils'
import { SeverityBadge } from './severity-badge'

interface LogRowDetailProps {
  log: FlatLogRecord
}

// ── Inline copy button ──────────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
      aria-label={`Copy ${label ?? 'value'}`}
    >
      {copied
        ? <Check size={10} className="text-green-500" />
        : <Copy size={10} />}
    </button>
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={11} className="text-muted-foreground/60 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 select-none">
        {children}
      </span>
    </div>
  )
}

// ── JSON body renderer ──────────────────────────────────────────────────────
function JsonBody({ raw }: { raw: string }) {
  let pretty = raw
  try { pretty = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* keep raw */ }
  return (
    <pre className="font-mono text-[11.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-all rounded-md bg-muted/40 border border-border/60 px-3 py-2.5 overflow-x-auto">
      {pretty}
    </pre>
  )
}

// ── Collapsible attribute table ─────────────────────────────────────────────
function AttributeSection({
  icon: Icon,
  title,
  attrs,
  defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  attrs: Record<string, string>
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const entries = Object.entries(attrs)
  if (entries.length === 0) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 w-full text-left mb-1.5"
        aria-expanded={open}
      >
        <Icon size={11} className="text-muted-foreground/60 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 select-none">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">({entries.length})</span>
        <ChevronRight
          size={11}
          className={`ml-auto text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          {entries.map(([key, val], i) => (
            <div
              key={key}
              className={`group/row flex items-start min-w-0 ${i > 0 ? 'border-t border-border/40' : ''}`}
            >
              <dt className="shrink-0 font-mono text-[11.5px] text-muted-foreground px-3 py-1.5 w-[42%] truncate border-r border-border/40 bg-muted/20 select-all">
                {key}
              </dt>
              <dd className="flex items-start gap-0.5 min-w-0 px-3 py-1.5 flex-1">
                <span className="font-mono text-[11.5px] text-foreground/90 break-all select-all leading-relaxed flex-1">
                  {val}
                </span>
                <div className="opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                  <CopyButton value={val} label={key} />
                </div>
              </dd>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main detail panel ───────────────────────────────────────────────────────
export function LogRowDetail({ log }: LogRowDetailProps) {
  const serviceLabel = [log.serviceNamespace, log.serviceName].filter(Boolean).join(' / ')

  const resourceAttrsFiltered = Object.fromEntries(
    Object.entries(log.resourceAttributes).filter(
      ([k]) => !['service.name', 'service.namespace', 'service.version'].includes(k)
    )
  )

  return (
    <div className="border-t border-border bg-muted/10">
      {/* Top meta bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border/60 bg-muted/20 flex-wrap">
        <SeverityBadge band={log.severityBand} text={log.severityText} />

        <div className="flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground">
          <Clock size={11} className="shrink-0" />
          <span className="text-foreground/80 tabular-nums">{formatAbsoluteTime(log.timestamp)}</span>
        </div>

        {serviceLabel && (
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground">
            <Server size={11} className="shrink-0" />
            <span className="text-foreground/80">{serviceLabel}</span>
            {log.serviceVersion && (
              <span className="text-muted-foreground/60">v{log.serviceVersion}</span>
            )}
          </div>
        )}

        {log.scopeName && (
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground">
            <Layers size={11} className="shrink-0" />
            <span className="text-muted-foreground/70">{log.scopeName}</span>
          </div>
        )}

        {log.droppedAttributesCount > 0 && (
          <div className="flex items-center gap-1 ml-auto text-[11px] font-mono text-amber-500">
            <AlertTriangle size={11} />
            {log.droppedAttributesCount} dropped
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel icon={FileText}>Body</SectionLabel>
          <CopyButton value={log.body} label="body" />
        </div>
        {log.bodyIsJson ? (
          <JsonBody raw={log.body} />
        ) : (
          <p className="font-mono text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words rounded-md bg-muted/40 border border-border/60 px-3 py-2.5">
            {log.body}
          </p>
        )}
      </div>

      {/* Attribute sections */}
      <div className="px-4 pb-3">
        <AttributeSection icon={Tag} title="Log Attributes" attrs={log.logAttributes} defaultOpen={true} />
        <AttributeSection icon={Server} title="Resource Attributes" attrs={resourceAttrsFiltered} defaultOpen={false} />
        <AttributeSection icon={Layers} title="Scope Attributes" attrs={log.scopeAttributes} defaultOpen={false} />
      </div>
    </div>
  )
}
