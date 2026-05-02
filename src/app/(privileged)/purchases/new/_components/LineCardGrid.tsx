'use client'

import React from 'react'
import type { PurchaseLine } from '@/types/erp'
import { Package, Trash2, Shield, Info, DollarSign, Layers } from 'lucide-react'
import { getProcurementStatus } from '@/lib/procurement-status'

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
  const procurement = getProcurementStatus(line.procurement_status as string | undefined)

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

        {/* Procurement Status Badge — canonical vocabulary (NONE/REQUESTED/PO_SENT/...). */}
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
        <h3 className="text-[14px] font-black text-app-foreground leading-tight truncate mb-1">
          {String(line.productName || 'Unknown Product')}
        </h3>
        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mb-4">
          SKU-{String(line.productId || 0).padStart(4, '0')}
        </p>

        {/* CONTROLS GRID */}
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

        {/* STATS STRIP */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-tight">Stock Total</span>
            <span className="text-[12px] font-black text-app-foreground tabular-nums">{Number(line.stockTotal || 0)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-tight">Sales</span>
            <span className="text-[12px] font-black text-app-info tabular-nums">{String(line.salesMonthly || '0')}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-tight">Line Total</span>
            <span className="text-[12px] font-black text-app-foreground tabular-nums">
              {((Number(line.quantity || 0)) * (Number(line.unitCostHT || 0))).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
