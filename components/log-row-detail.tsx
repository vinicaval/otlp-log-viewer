'use client'

import { useState } from 'react'
import {
  Copy,
  Check,
  ChevronRight,
  FileJson,
  AlignLeft,
  Hash,
  Clock,
  Eye,
  GitBranch,
  Boxes,
  Server,
  Layers,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import type { FlatLogRecord } from '@/lib/otlp-types'
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/otlp-utils'
import { SeverityBadge } from './severity-badge'

interface LogRowDetailProps {
  log: FlatLogRecord
}

// ── Copy-to-clipboard button (icon only, hover reveal friendly) ─────────────
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
      className="inline-flex items-center justify-center size-5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-all"
      aria-label={`Copy ${label ?? 'value'}`}
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

// ── Property row: label on the left, value on the right ─────────────────────
function PropertyRow({
  icon: Icon,
  label,
  children,
  mono = true,
  copyValue,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
  mono?: boolean
  copyValue?: string
}) {
  return (
    <div className="group/prop flex items-center gap-3 px-3 h-9 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 w-[150px] shrink-0">
        <Icon size={13} className="text-muted-foreground/50 shrink-0" aria-hidden />
        <span className="text-[11px] font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className={`text-[12px] text-foreground/90 truncate ${mono ? 'font-mono' : 'font-sans'}`}
        >
          {children}
        </span>
        {copyValue && (
          <span className="opacity-0 group-hover/prop:opacity-100 transition-opacity shrink-0">
            <CopyButton value={copyValue} label={label} />
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section shell with header ───────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  count,
  action,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const HeaderTag = collapsible ? 'button' : 'div'

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <HeaderTag
        {...(collapsible
          ? { onClick: () => setOpen((v) => !v), 'aria-expanded': open, type: 'button' as const }
          : {})}
        className={`flex items-center gap-2 w-full px-3 h-9 bg-muted/40 border-b border-border/60 text-left ${
          collapsible ? 'hover:bg-muted/60 transition-colors cursor-pointer' : ''
        } ${open ? '' : 'border-b-0'}`}
      >
        {collapsible && (
          <ChevronRight
            size={12}
            className={`text-muted-foreground/50 shrink-0 transition-transform duration-150 ${
              open ? 'rotate-90' : ''
            }`}
            aria-hidden
          />
        )}
        <Icon size={12} className="text-muted-foreground/60 shrink-0" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground select-none">
          {title}
        </span>
        {count !== undefined && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5">
            {count}
          </span>
        )}
        {action && <div className="ml-auto flex items-center">{action}</div>}
      </HeaderTag>
      {open && children}
    </div>
  )
}

// ── Key/value attribute table ───────────────────────────────────────────────
function AttributeTable({ attrs }: { attrs: Record<string, string> }) {
  const entries = Object.entries(attrs)
  if (entries.length === 0) {
    return (
      <div className="px-3 py-2.5 text-[12px] font-mono text-muted-foreground/60 italic">
        No attributes
      </div>
    )
  }
  return (
    <div>
      {entries.map(([key, val], i) => (
        <div
          key={key}
          className={`group/row flex items-start min-w-0 ${
            i > 0 ? 'border-t border-border/40' : ''
          } hover:bg-muted/30 transition-colors`}
        >
          <dt className="shrink-0 font-mono text-[11.5px] text-muted-foreground px-3 py-2 w-[38%] max-w-[220px] break-all border-r border-border/40 bg-muted/20 select-all">
            {key}
          </dt>
          <dd className="flex items-start gap-1 min-w-0 px-3 py-2 flex-1">
            <span className="font-mono text-[11.5px] text-foreground/90 break-all select-all leading-relaxed flex-1">
              {val}
            </span>
            <span className="opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 mt-[-1px]">
              <CopyButton value={val} label={key} />
            </span>
          </dd>
        </div>
      ))}
    </div>
  )
}

// ── Body / message renderer ─────────────────────────────────────────────────
function MessageBlock({ body, isJson }: { body: string; isJson: boolean }) {
  let content = body
  if (isJson) {
    try {
      content = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      /* keep raw */
    }
  }
  return (
    <pre className="font-mono text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words px-3 py-2.5 max-h-72 overflow-auto">
      {content}
    </pre>
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

  // trace.id/span.id already surface as dedicated Trace ID/Span ID rows
  // above (see log.traceId/log.spanId) — don't show them a second time
  // in the generic attribute list.
  const logAttrsFiltered = Object.fromEntries(
    Object.entries(log.logAttributes).filter(([k]) => !['trace.id', 'span.id'].includes(k))
  )

  return (
    <div className="border-t border-border bg-muted/[0.03] px-4 py-4 flex flex-col gap-4">
      {/* Header: severity + timestamps */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <SeverityBadge band={log.severityBand} text={log.severityText} />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5">
            #{log.severityNumber}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-mono text-[12px] tabular-nums text-foreground/90">
            {formatAbsoluteTime(log.timestamp)}
          </span>
          <span
            className="font-mono text-[11px] text-muted-foreground/70"
            suppressHydrationWarning
          >
            {formatRelativeTime(log.timestamp)}
          </span>
        </div>
      </div>

      {/* Message */}
      <Section
        icon={log.bodyIsJson ? FileJson : AlignLeft}
        title="Message"
        action={<CopyButton value={log.body} label="message" />}
      >
        <MessageBlock body={log.body} isJson={log.bodyIsJson} />
      </Section>

      {/* Metadata / properties inspector */}
      <Section icon={Boxes} title="Metadata">
        <div>
          <PropertyRow icon={Hash} label="Severity">
            {log.severityText} ({log.severityBand})
          </PropertyRow>
          <PropertyRow icon={Clock} label="Timestamp" copyValue={formatAbsoluteTime(log.timestamp)}>
            {formatAbsoluteTime(log.timestamp)}
          </PropertyRow>
          {log.observedTimestamp && (
            <PropertyRow
              icon={Eye}
              label="Observed"
              copyValue={formatAbsoluteTime(log.observedTimestamp)}
            >
              {formatAbsoluteTime(log.observedTimestamp)}
            </PropertyRow>
          )}
          {serviceLabel && (
            <PropertyRow icon={Server} label="Service" copyValue={serviceLabel}>
              {serviceLabel}
              {log.serviceVersion && (
                <span className="text-muted-foreground/60"> v{log.serviceVersion}</span>
              )}
            </PropertyRow>
          )}
          {log.scopeName && (
            <PropertyRow icon={Layers} label="Scope" copyValue={log.scopeName}>
              {log.scopeName}
              {log.scopeVersion && (
                <span className="text-muted-foreground/60"> v{log.scopeVersion}</span>
              )}
            </PropertyRow>
          )}
          {log.traceId && (
            <PropertyRow icon={GitBranch} label="Trace ID" copyValue={log.traceId}>
              {log.traceId}
            </PropertyRow>
          )}
          {log.spanId && (
            <PropertyRow icon={GitBranch} label="Span ID" copyValue={log.spanId}>
              {log.spanId}
            </PropertyRow>
          )}
          {log.droppedAttributesCount > 0 && (
            <PropertyRow icon={AlertTriangle} label="Dropped attrs">
              <span className="text-amber-500">{log.droppedAttributesCount}</span>
            </PropertyRow>
          )}
        </div>
      </Section>

      {/* Attribute groups */}
      <Section
        icon={Tag}
        title="Log Attributes"
        count={Object.keys(logAttrsFiltered).length}
        collapsible
        defaultOpen
      >
        <AttributeTable attrs={logAttrsFiltered} />
      </Section>

      {Object.keys(resourceAttrsFiltered).length > 0 && (
        <Section
          icon={Server}
          title="Resource Attributes"
          count={Object.keys(resourceAttrsFiltered).length}
          collapsible
          defaultOpen={false}
        >
          <AttributeTable attrs={resourceAttrsFiltered} />
        </Section>
      )}

      {Object.keys(log.scopeAttributes).length > 0 && (
        <Section
          icon={Layers}
          title="Scope Attributes"
          count={Object.keys(log.scopeAttributes).length}
          collapsible
          defaultOpen={false}
        >
          <AttributeTable attrs={log.scopeAttributes} />
        </Section>
      )}
    </div>
  )
}
