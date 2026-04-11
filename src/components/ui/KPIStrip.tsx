'use client'

/**
 * KPI Strip
 * ==========
 * Compact summary cards showing total products, combos, out-of-stock, and avg price.
 * Reusable — accepts generic stat items.
 */

import React from 'react'

export interface KPIStat {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

export const KPIStrip = React.memo(function KPIStrip({ stats }: { stats: KPIStat[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
            <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
})
