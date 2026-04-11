'use client'

/**
 * Searchable Dropdown
 * ====================
 * Reusable dropdown with inline search, NOT-mode toggle, and clear.
 * Fully standalone — no external dependencies beyond React.
 */

import { useState, useEffect, useRef } from 'react'

interface SearchableDropdownProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  label: string
}

export function SearchableDropdown({ value, onChange, options, placeholder, label }: SearchableDropdownProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = q
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : options

  // NOT mode: value starts with '!'
  const isNot = value.startsWith('!')
  const rawValue = isNot ? value.slice(1) : value
  const display = rawValue ? options.find(o => o.value === rawValue)?.label || rawValue : placeholder
  const displayLabel = isNot ? `NOT: ${display}` : display

  const toggleNot = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!rawValue) return
    onChange(isNot ? rawValue : `!${rawValue}`)
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => { setOpen(!open); setQ('') }}
          className={`flex-1 text-left text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all truncate ${rawValue
            ? isNot
              ? 'border-red-400/60 text-red-400 bg-red-500/5'
              : 'border-app-primary/40 text-app-foreground bg-app-primary/5'
            : 'border-app-border/50 text-app-muted-foreground bg-app-surface/50'
            }`}
        >
          {displayLabel}
        </button>
        {rawValue && (
          <button type="button" onClick={toggleNot} title={isNot ? 'Switch to Include' : 'Switch to Exclude'}
            className={`w-7 flex-shrink-0 flex items-center justify-center rounded-lg border text-[10px] font-black transition-all ${isNot
              ? 'border-red-400/60 text-red-400 bg-red-500/10 hover:bg-red-500/20'
              : 'border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
              }`}>
            {isNot ? '≠' : '='}
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] border border-app-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ background: 'var(--app-surface)' }}>
          {options.length > 6 && (
            <div className="p-1.5 border-b border-app-border/50">
              <input
                type="text" value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Search..."
                className="w-full text-[11px] px-2 py-1.5 rounded-lg bg-app-bg border border-app-border/50 text-app-foreground placeholder:text-app-muted-foreground outline-none"
              />
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto overscroll-contain custom-scrollbar">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full text-left text-[11px] px-3 py-2 hover:bg-app-primary/5 transition-colors ${!rawValue ? 'font-black text-app-primary' : 'font-bold text-app-muted-foreground'}`}
            >
              {placeholder}
            </button>
            {filtered.map(o => (
              <button
                key={o.value} type="button"
                onClick={() => { onChange(isNot ? `!${o.value}` : o.value); setOpen(false) }}
                className={`w-full text-left text-[11px] px-3 py-2 hover:bg-app-primary/5 transition-colors truncate ${rawValue === o.value ? 'font-black text-app-primary bg-app-primary/5' : 'font-bold text-app-foreground'
                  }`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-app-muted-foreground text-center">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
