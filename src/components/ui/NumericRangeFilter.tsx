'use client'

/**
 * Numeric Range Filter
 * =====================
 * Popup for filtering by numeric ranges (eq, gt, lt, between, etc.)
 */

import { useState, useEffect, useRef } from 'react'

/** Numeric range filter value shape */
export type NumericRange = {
  op: '' | 'eq' | 'between' | 'gt' | 'lt' | 'gte' | 'lte'
  a: string
  b: string
  field?: string
}

export const EMPTY_RANGE: NumericRange = { op: '', a: '', b: '' }

interface NumericRangeFilterProps {
  value: NumericRange
  onChange: (v: NumericRange) => void
  label: string
  fieldOptions?: { value: string; label: string }[]
}

export function NumericRangeFilter({ value, onChange, label, fieldOptions }: NumericRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasValue = value.op !== ''
  const display = hasValue
    ? value.op === 'eq' ? `= ${value.a}`
      : value.op === 'between' ? `${value.a} — ${value.b}`
        : value.op === 'gt' ? `> ${value.a}`
          : value.op === 'lt' ? `< ${value.a}`
            : value.op === 'gte' ? `≥ ${value.a}`
              : value.op === 'lte' ? `≤ ${value.a}`
                : label
    : label

  const inp = "w-full text-[11px] font-mono px-2 py-1.5 rounded-lg bg-app-bg border border-app-border/50 text-app-foreground outline-none"

  return (
    <div ref={ref} className="relative">
      <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full text-left text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all truncate ${hasValue ? 'border-app-primary/40 text-app-foreground bg-app-primary/5' : 'border-app-border/50 text-app-muted-foreground bg-app-surface/50'
          }`}
      >
        {display}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[240px] p-3 border border-app-border rounded-xl shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ background: 'var(--app-surface)' }}>
          {fieldOptions && (
            <div className="mb-2">
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Field</label>
              <select
                value={value.field || fieldOptions[0]?.value || ''}
                onChange={e => onChange({ ...value, field: e.target.value })}
                className="w-full text-[11px] font-bold px-2 py-1.5 rounded-lg bg-app-bg border border-app-border/50 text-app-foreground outline-none"
              >
                {fieldOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          )}
          <div className="mb-2">
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Operator</label>
            <select
              value={value.op}
              onChange={e => onChange({ ...value, op: e.target.value as NumericRange['op'] })}
              className="w-full text-[11px] font-bold px-2 py-1.5 rounded-lg bg-app-bg border border-app-border/50 text-app-foreground outline-none"
            >
              <option value="">No filter</option>
              <option value="eq">= Equal to</option>
              <option value="gt">&gt; Greater than</option>
              <option value="gte">≥ Greater or equal</option>
              <option value="lt">&lt; Less than</option>
              <option value="lte">≤ Less or equal</option>
              <option value="between">Between X and Y</option>
            </select>
          </div>
          {value.op && value.op !== 'between' && (
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Value</label>
              <input type="number" value={value.a} onChange={e => onChange({ ...value, a: e.target.value })} className={inp} placeholder="0" />
            </div>
          )}
          {value.op === 'between' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Min</label>
                <input type="number" value={value.a} onChange={e => onChange({ ...value, a: e.target.value })} className={inp} placeholder="0" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Max</label>
                <input type="number" value={value.b} onChange={e => onChange({ ...value, b: e.target.value })} className={inp} placeholder="0" />
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => { onChange(EMPTY_RANGE); setOpen(false) }}
              className="flex-1 text-[11px] font-bold py-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
