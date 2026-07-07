'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { FlatLogRecord } from '@/lib/otlp-types'
import { AttributeGrid } from './attribute-grid'

interface LogRowDetailProps {
  log: FlatLogRecord
}

function JsonBody({ raw }: { raw: string }) {
  const parsed = JSON.parse(raw)
  const pretty = JSON.stringify(parsed, null, 2)
  return (
    <pre className="font-mono text-[12px] leading-relaxed text-foreground whitespace-pre-wrap break-all overflow-x-auto rounded-md bg-muted/50 border border-border p-3 mt-1">
      {pretty}
    </pre>
  )
}

function CopyButtonInline({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1 ml-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function LogRowDetail({ log }: LogRowDetailProps) {
  const serviceLabel = [log.serviceNamespace, log.serviceName]
    .filter(Boolean)
    .join(' / ')

  const resourceAttrsFiltered = Object.fromEntries(
    Object.entries(log.resourceAttributes).filter(
      ([k]) => !['service.name', 'service.namespace', 'service.version'].includes(k)
    )
  )

  return (
    <div className="px-4 py-3 bg-muted/20 border-t border-border font-sans text-[13px]">
      {/* Service header */}
      {serviceLabel && (
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Service
          </span>
          <span className="font-mono text-[12px] text-foreground">{serviceLabel}</span>
          {log.serviceVersion && (
            <span className="font-mono text-[11px] text-muted-foreground">
              v{log.serviceVersion}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="mb-3">
        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Body
          <CopyButtonInline value={log.body} label="body" />
        </div>
        {log.bodyIsJson ? (
          <JsonBody raw={log.body} />
        ) : (
          <p className="font-mono text-[12px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {log.body}
          </p>
        )}
      </div>

      {/* Attributes */}
      <AttributeGrid
        title="Log Attributes"
        attrs={log.logAttributes}
        defaultOpen={true}
      />
      <AttributeGrid
        title="Resource Attributes"
        attrs={resourceAttrsFiltered}
        defaultOpen={false}
      />
      <AttributeGrid
        title="Scope Attributes"
        attrs={log.scopeAttributes}
        defaultOpen={false}
      />

      {/* Scope name */}
      {log.scopeName && (
        <p className="mt-2 text-[11px] text-muted-foreground font-mono">
          scope: {log.scopeName}
        </p>
      )}

      {log.droppedAttributesCount > 0 && (
        <p className="mt-1 text-[11px] text-amber-500 font-mono">
          {log.droppedAttributesCount} attribute(s) dropped
        </p>
      )}
    </div>
  )
}
