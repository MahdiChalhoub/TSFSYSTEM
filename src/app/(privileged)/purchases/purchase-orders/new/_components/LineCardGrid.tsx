'use client'

import React from 'react'
import type { PurchaseLine } from '@/types/erp'
import { Package, Trash2, Shield, Info, DollarSign, Layers } from 'lucide-react'
import { getPipelineStatus } from '@/lib/procurement-status'

const fmt = (v: number | string) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? '0' : n.toLocaleString()
}

interface Props {
  lines: PurchaseLine[]
  onUpdate: (idx: number, updates: Record<string, any>) => void
  onRemove: (idx: number) => void
}

export function LineCardGrid({ lines, onUpdate, onRemove }: Props) {
  if (lines.length === 0) return null

  return (
    <div 
      className="p-4 animate-in fade-in duration-300"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
      }}
    >
      {lines.map((line, idx) => (
        <LineCard
          key={`${line.productId}-${idx}`}
          line={line}
          onUpdate={(updates) => onUpdate(idx, updates)}
          onRemove={() => onRemove(idx)}
        />
      ))}
    </div>
  )
}

function LineCard({ line, onUpdate, onRemove }: {
  line: PurchaseLine
  onUpdate: (updates: Record<string, any>) => void
  onRemove: () => void
}) {
  const procurement = getPipelineStatus(line.pipeline_status as string | undefined)

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: 'var(--app-surface)',
        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
      }}
    >
      {/* HEADER / IMAGE AREA */}
      <div
        className="relative w-full h-[120px] flex items-center justify-center"
        style={{
          background: 'color-mix(in srgb, var(--app-border) 8%, var(--app-background))',
        }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
             style={{ 
               background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', 
               color: 'var(--app-primary)',
               boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--app-primary) 30%, transparent)'
             }}>
          <Package size={28} />
        </div>

        {/* Procurement Status Badge — canonical vocabulary (NONE/REQUESTED/
            PO_SENT/...). Hidden when the line has no real pipeline status
            (a fresh PO line that hasn't been requested anywhere) — showing
            "Available" on every brand-new line was misleading because it
            described the underlying product's general state, not the line. */}
        {!!line.pipeline_status && (line.pipeline_status as string) !== 'NONE' && (
          <span
            className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border"
            style={{
              background: `color-mix(in srgb, ${procurement.color} 12%, transparent)`,
              color: procurement.color,
              borderColor: `color-mix(in srgb, ${procurement.color} 30%, transparent)`,
            }}
          >
            {procurement.label}
          </span>
        )}

        {/* Expiry Badge */}
        {!!line.expirySafety && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg"
               style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
            <Shield size={10} />
            <span className="text-[9px] font-black uppercase tracking-widest">{String(line.expirySafety || '')}</span>
          </div>
        )}

        {/* Delete Button (Hover) */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center bg-app-surface border border-app-border text-app-muted-foreground/40 hover:text-app-error hover:bg-app-error/10 hover:border-app-error/20 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* BODY */}
      <div className="p-4">
        <h3 className="truncate mb-1">
          {String(line.productName || 'Unknown Product')}
        </h3>
        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mb-4">
          SKU-{String(line.productId || 0).padStart(4, '0')}
        </p>

        {/* EDITABLE CONTROLS — quantity + unit cost are the only fields
            the operator changes per line; everything else below is read-only
            context to inform the decision. */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Quantity</label>
            <input
              type="number"
              className="w-full rounded-xl px-3 py-2 text-[13px] font-black outline-none border transition-all"
              style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}
              value={Number(line.quantity || 0)}
              onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Unit Cost HT</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground opacity-40"><DollarSign size={10} /></span>
              <input
                type="number"
                className="w-full pl-7 rounded-xl px-3 py-2 text-[13px] font-black outline-none border transition-all"
                style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}
                value={Number(line.unitCostHT || 0)}
                onChange={(e) => onUpdate({ unitCostHT: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* CONTEXT GRID — mirrors the list-view columns split across 2 rows.
            Each cell: tiny label + sub-label + value(s). Same vocabulary
            as PurchaseColumns.tsx so users see the same data in either view. */}
        <div className="pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
          {/* Row 1 — supply-side context: what was asked for, what's
              already in stock / on the way, and how many POs are open. */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Stat label="Requested" value={fmt(Number(line.requested || 0))} />
            <Stat label="Required" sub="proposed" value={fmt(Number(line.requiredProposed || 0))} />
            <Stat label="Stock" sub="transit · total" value={
              <span>
                <span className="opacity-60">{fmt(Number(line.stockTransit || 0))}</span>
                <span className="opacity-40 mx-0.5">·</span>
                <span>{fmt(Number(line.stockTotal || 0))}</span>
              </span>
            } />
            <Stat label="PO" sub="count" value={fmt(Number(line.poCount || 0))} />
          </div>
          {/* Row 2 — demand-side context: how it's selling, score signal,
              cost vs sell vs supplier price, and expiry safety window. */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Sales" sub="monthly" value={fmt(Number(line.salesMonthly || 0))} accent="var(--app-info, #3b82f6)" />
            <Stat label="Cost" sub="sell" value={
              <span>
                <span>{fmt(Number(line.unitCostHT || 0))}</span>
                <span className="opacity-40 mx-0.5">·</span>
                <span className="opacity-60">{fmt(Number(line.sellingPriceHT || 0))}</span>
              </span>
            } />
            <Stat label="Supplier" sub="price" value={fmt(Number(line.supplierPrice || 0))} accent="var(--app-error, #ef4444)" />
            <Stat label="Expiry" sub="safety" value={String(line.expirySafety || '—')} accent="var(--app-success, #10b981)" />
          </div>
        </div>

        {/* LINE TOTAL — pinned at the bottom, computed live from qty × cost. */}
        <div className="mt-3 pt-3 flex items-center justify-between border-t"
             style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
          <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Line Total HT</span>
          <span className="text-[14px] font-black text-app-foreground tabular-nums">
            {((Number(line.quantity || 0)) * (Number(line.unitCostHT || 0))).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Reusable mini-stat cell — label + optional sub-label + value, matching
 *  the column-header treatment in the list view. Keeps every card cell
 *  visually identical so users can scan across cards quickly. */
function Stat({ label, sub, value, accent }: {
  label: string
  sub?: string
  value: React.ReactNode
  accent?: string
}) {
  return (
    <div className="flex flex-col items-start min-w-0">
      <div className="flex items-baseline gap-1">
        <span className="text-[9px] font-black text-app-foreground uppercase tracking-tight">{label}</span>
        {sub && <span className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-tight opacity-70">{sub}</span>}
      </div>
      <span className="text-[12px] font-black tabular-nums truncate w-full"
            style={{ color: accent || 'var(--app-foreground)' }}>
        {value}
      </span>
    </div>
  )
}
