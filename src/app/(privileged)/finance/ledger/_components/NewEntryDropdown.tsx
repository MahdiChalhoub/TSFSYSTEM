'use client'

/**
 * New Entry Dropdown
 * ====================
 * Full-cycle routing dropdown for creating journal entries.
 * Only GENERAL creates a raw JE. All others route to source documents.
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Plus, ChevronDown, FileText, Activity,
  AlertTriangle, ShieldCheck, Edit, Globe,
} from 'lucide-react'

const JOURNAL_ROUTES: { type: string; label: string; desc: string; href: string; icon: any; color: string }[] = [
  { type: 'GENERAL', label: 'General Journal', desc: 'Manual debit/credit voucher', href: '/finance/ledger/new', icon: FileText, color: 'var(--app-primary)' },
  { type: 'SALES', label: 'Sales Invoice', desc: 'Create invoice → auto-posts JE', href: '/finance/invoices/new', icon: FileText, color: 'var(--app-success)' },
  { type: 'PURCHASE', label: 'Purchase Invoice', desc: 'Record purchase → auto-posts JE', href: '/finance/invoices/new?type=purchase', icon: FileText, color: 'var(--app-info)' },
  { type: 'CASH', label: 'Payment / Receipt', desc: 'Cash or bank transaction', href: '/finance/payments/new', icon: Activity, color: 'var(--app-warning)' },
  { type: 'EXPENSE', label: 'Expense Entry', desc: 'Record expense → auto-posts JE', href: '/finance/expenses/new', icon: AlertTriangle, color: 'var(--app-error)' },
  { type: 'BANK', label: 'Bank Transaction', desc: 'Bank payment or deposit', href: '/finance/payments/new?method=bank', icon: Globe, color: 'var(--app-info)' },
  { type: 'TAX', label: 'Tax Adjustment', desc: 'VAT settlement or tax accrual', href: '/finance/vat-settlement/new', icon: ShieldCheck, color: 'var(--app-info)' },
  { type: 'ADJUSTMENT', label: 'Adjustment Entry', desc: 'Period-end or correction JE', href: '/finance/ledger/new?type=ADJUSTMENT', icon: Edit, color: 'var(--app-warning)' },
]

export function NewEntryDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
        <Plus size={14} /><span className="hidden sm:inline">New Entry</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[300px] z-50 rounded-2xl border border-app-border/60 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-150"
          style={{ background: 'var(--app-bg)', backdropFilter: 'blur(20px)' }}>
          <div className="px-3 py-2 border-b border-app-border/40">
            <span className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide">Create New Entry</span>
          </div>
          <div className="p-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
            {JOURNAL_ROUTES.map(r => (
              <Link key={r.type} href={r.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-app-surface/60 transition-all group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                  style={{ background: `color-mix(in srgb, ${r.color} 10%, transparent)`, color: r.color }}>
                  <r.icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-tp-md font-bold text-app-foreground">{r.label}</div>
                  <div className="text-tp-xs text-app-muted-foreground">{r.desc}</div>
                </div>
                {r.type === 'GENERAL' && (
                  <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary flex-shrink-0">Manual</span>
                )}
              </Link>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-app-border/40">
            <p className="text-tp-xxs text-app-muted-foreground leading-relaxed">
              <strong>General Journal</strong> creates a manual voucher. All other types route to the full business document, which auto-generates the journal entry.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
