'use client'

/**
 * Ledger Filters Panel
 * ======================
 * Filter controls for the General Ledger list view.
 */

import { useMemo } from 'react'
import type { LedgerFilters, Lookups } from '../_lib/types'
import {
  STATUS_CONFIG, AUTO_SOURCE_CONFIG, DEFAULT_VISIBLE_FILTERS,
} from '../_lib/constants'

export function LedgerFiltersPanel({ filters, setFilters, isOpen, lookups, visibleFilters }: {
  filters: LedgerFilters; setFilters: (f: LedgerFilters) => void; isOpen: boolean; lookups: Lookups; visibleFilters?: Record<string, boolean>
}) {
  if (!isOpen) return null
  const vf = visibleFilters || DEFAULT_VISIBLE_FILTERS
  const sel = "w-full text-tp-sm font-bold px-2.5 py-2 rounded-xl border border-app-border/50 bg-app-surface/50 text-app-foreground outline-none transition-all cursor-pointer appearance-none"
  const lbl = "text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide mb-1 block"
  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-200 p-3 rounded-2xl border border-app-border/50"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
        {vf.status !== false && <div>
          <label className={lbl}>Status</label>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className={sel}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>}
        {vf.entryType !== false && <div>
          <label className={lbl}>Entry Type</label>
          <select value={filters.entryType} onChange={e => setFilters({ ...filters, entryType: e.target.value })} className={sel}>
            <option value="">All Types</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Bot Activity</option>
          </select>
        </div>}
        {vf.journalType !== false && <div>
          <label className={lbl}>Journal Type</label>
          <select value={filters.journalType || ''} onChange={e => setFilters({ ...filters, journalType: e.target.value })} className={sel}>
            <option value="">All Journals</option>
            {['GENERAL','SALES','PURCHASE','CASH','BANK','INVENTORY','PAYROLL','TAX','CLOSING','OPENING','ADJUSTMENT'].map(j => <option key={j} value={j}>{j.charAt(0) + j.slice(1).toLowerCase()}</option>)}
          </select>
        </div>}
        {vf.fiscalYear !== false && <div>
          <label className={lbl}>Fiscal Year</label>
          <select value={filters.fiscalYear} onChange={e => setFilters({ ...filters, fiscalYear: e.target.value })} className={sel}>
            <option value="">All Years</option>
            {lookups.fiscalYears.map(fy => <option key={fy.id} value={String(fy.id)}>{fy.name}</option>)}
          </select>
        </div>}
        {vf.scope !== false && <div>
          <label className={lbl}>Scope</label>
          <select value={filters.scope || ''} onChange={e => setFilters({ ...filters, scope: e.target.value })} className={sel}>
            <option value="">All Scopes</option>
            <option value="OFFICIAL">Official</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </div>}
        {vf.user !== false && <div>
          <label className={lbl}>Initiator</label>
          <select value={filters.user} onChange={e => setFilters({ ...filters, user: e.target.value })} className={sel}>
            <option value="">All Users</option>
            {lookups.users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </select>
        </div>}
        {vf.autoSource !== false && <div>
          <label className={lbl}>Auto Source</label>
          <select value={filters.autoSource} onChange={e => setFilters({ ...filters, autoSource: e.target.value })} className={sel}>
            <option value="">All Systems</option>
            {Object.entries(AUTO_SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>}
        {vf.isLocked && <div>
          <label className={lbl}>Locked</label>
          <select value={filters.isLocked || ''} onChange={e => setFilters({ ...filters, isLocked: e.target.value })} className={sel}>
            <option value="">All</option>
            <option value="yes">Locked</option>
            <option value="no">Unlocked</option>
          </select>
        </div>}
        {vf.isVerified && <div>
          <label className={lbl}>Verified</label>
          <select value={filters.isVerified || ''} onChange={e => setFilters({ ...filters, isVerified: e.target.value })} className={sel}>
            <option value="">All</option>
            <option value="yes">Verified</option>
            <option value="no">Unverified</option>
          </select>
        </div>}
        {vf.sourceModule && <div>
          <label className={lbl}>Source Module</label>
          <select value={filters.sourceModule || ''} onChange={e => setFilters({ ...filters, sourceModule: e.target.value })} className={sel}>
            <option value="">All Modules</option>
            {['sales','purchases','inventory','pos','payroll','manual'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>}
        {vf.dateFrom !== false && <div>
          <label className={lbl}>Date From</label>
          <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
            className={sel} />
        </div>}
        {vf.dateTo !== false && <div>
          <label className={lbl}>Date To</label>
          <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
            className={sel} />
        </div>}
      </div>
    </div>
  )
}
