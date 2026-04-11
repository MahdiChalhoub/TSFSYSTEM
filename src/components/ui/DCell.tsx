'use client'

/**
 * DCell — Detail Cell
 * ====================
 * Small label + value pair used in expandable detail cards.
 * Shared across all list-view modules (Products, PO, etc.)
 */

export function DCell({ label, value, mono, color }: {
  label: string
  value: any
  mono?: boolean
  color?: string
}) {
  return (
    <div>
      <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest leading-tight">{label}</div>
      <div className={`font-bold text-app-foreground leading-tight ${mono ? 'font-mono tabular-nums' : ''}`}
        style={color && value && value !== '—' ? { color } : undefined}>
        {value ?? '—'}
      </div>
    </div>
  )
}
