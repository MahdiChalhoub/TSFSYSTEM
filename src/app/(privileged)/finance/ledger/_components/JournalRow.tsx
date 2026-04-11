'use client'

/**
 * Journal Row — Memoized
 * ========================
 * Single journal entry row with mobile card, desktop table row, and expansion detail.
 */

import React, { useState, useRef } from 'react'
import {
  FileText, Eye, Edit, MoreHorizontal,
  ChevronRight, ChevronDown, ShieldCheck, RotateCcw, Clock, Lock, Unlock,
} from 'lucide-react'
import { DCell } from '@/components/ui/DCell'
import { LedgerEntryActions } from '../ledger-actions'
import type { JournalEntry } from '../_lib/types'
import {
  STATUS_CONFIG, ALL_COLUMNS, COLUMN_WIDTHS, RIGHT_COLS, CENTER_COLS,
} from '../_lib/constants'

export const JournalRow = React.memo(function JournalRow({ entry, onView, fmt, isSelected, onToggleSelect, visibleColumns = {} }: {
  entry: JournalEntry
  onView: (id: number) => void
  fmt: (n: number) => string
  isSelected: boolean
  onToggleSelect: (id: number) => void
  visibleColumns?: Record<string, boolean>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sc = STATUS_CONFIG[entry.status] || STATUS_CONFIG.POSTED
  const lines = entry.lines || []
  const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
  const isLocked = entry.fiscalYear?.status === 'LOCKED' || entry.fiscalYear?.isLocked
  const dateStr = entry.transactionDate ? new Date(entry.transactionDate).toLocaleDateString('en-GB') : '—'

  return (
    <div>
      {/* ── MOBILE CARD (≤640px) ── */}
      <div
        className="sm:hidden border-b border-app-border/30 px-3 py-3 active:bg-app-surface/60 transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
            <FileText size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-app-foreground truncate">{entry.description || 'Journal Entry'}</div>
            <div className="text-[11px] font-mono text-app-muted-foreground mt-0.5">{entry.reference || `JV #${entry.id}`}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
                {sc.label}
              </span>
              <span className="text-[10px] font-bold text-app-muted-foreground">{dateStr}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[13px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>
              {fmt(totalDebit)}
            </div>
            <div className="text-[11px] font-bold text-app-muted-foreground mt-0.5">{lines.length} lines</div>
          </div>
        </div>
        {isOpen && <div className="flex items-center gap-2 mt-2 pt-2 border-t border-app-border/20">
          <button onClick={e => { e.stopPropagation(); onView(entry.id) }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-app-primary py-2 rounded-xl border border-app-primary/30 hover:bg-app-primary/5 transition-all">
            <Eye size={13} /> View Details
          </button>
        </div>}
      </div>

      {/* ── TABLE ROW (≥640px) ── */}
      <div
        className={`hidden sm:flex group items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5 ${isSelected ? 'bg-app-primary/5' : ''}`}
        style={{ paddingLeft: '12px', paddingRight: '12px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Checkbox */}
        <div className="w-5 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(entry.id)}
            className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onView(entry.id)}
            className="p-1 hover:bg-app-primary/10 rounded-md transition-colors text-app-muted-foreground hover:text-app-primary"
            title="View Details"><Eye size={12} /></button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-app-border/50 rounded-md transition-colors text-app-muted-foreground hover:text-app-foreground"
              title="More actions"><MoreHorizontal size={12} /></button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-48 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{ background: 'var(--app-surface)' }}>
                  <button onClick={() => { onView(entry.id); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                    <Eye size={12} className="text-app-primary" /> View Details
                  </button>
                  {entry.status !== 'REVERSED' && !isLocked && (
                    <button onClick={() => { window.location.href = `/finance/ledger/${entry.id}/edit`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Edit size={12} className="text-app-muted-foreground" /> Edit Entry
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="w-4 flex-shrink-0 flex items-center justify-center text-app-muted-foreground">
          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </div>

        {/* Status icon */}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
          {entry.status === 'POSTED' ? <ShieldCheck size={13} /> : entry.status === 'REVERSED' ? <RotateCcw size={13} /> : <Clock size={13} />}
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0 max-w-[280px]">
          <div className="truncate text-[12px] font-bold text-app-foreground">{entry.description || '—'}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-app-muted-foreground">#{entry.id}</span>
            {entry.reference?.startsWith('OPEN-') && (
              <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded"
                style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>Opening</span>
            )}
          </div>
        </div>

        {/* Dynamic columns */}
        {ALL_COLUMNS.map(col => {
          const isOn = col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key]
          if (!isOn) return null
          const w = COLUMN_WIDTHS[col.key] || 'w-16'
          const align = RIGHT_COLS.has(col.key) ? ' text-right' : CENTER_COLS.has(col.key) ? ' text-center' : ''
          let cellContent: any = '—'
          if (col.key === 'reference') cellContent = <span className="font-mono text-[10px]">{entry.reference || '—'}</span>
          else if (col.key === 'journalType') cellContent = <span className="text-[10px]">{(entry.journal_type || entry.journalType || '—')}</span>
          else if (col.key === 'scope') cellContent = entry.scope === 'OFFICIAL' ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>OFF</span> : <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>INT</span>
          else if (col.key === 'sourceModule') cellContent = entry.source_module || '—'
          else if (col.key === 'sourceModel') cellContent = <span className="truncate">{entry.source_model || '—'}</span>
          else if (col.key === 'sourceId') cellContent = entry.source_id || '—'
          else if (col.key === 'totalDebit') cellContent = <span className="font-mono tabular-nums" style={totalDebit > 0 ? { color: 'var(--app-primary)' } : undefined}>{totalDebit > 0 ? fmt(totalDebit) : '—'}</span>
          else if (col.key === 'totalCredit') cellContent = <span className="font-mono tabular-nums" style={totalCredit > 0 ? { color: 'var(--app-error)' } : undefined}>{totalCredit > 0 ? fmt(totalCredit) : '—'}</span>
          else if (col.key === 'lineCount') cellContent = lines.length
          else if (col.key === 'currency') cellContent = entry.currency || '—'
          else if (col.key === 'exchangeRate') cellContent = entry.exchange_rate ? Number(entry.exchange_rate).toFixed(4) : '—'
          else if (col.key === 'status') cellContent = <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span>
          else if (col.key === 'isLocked') cellContent = entry.is_locked ? <Lock size={11} className="text-app-warning mx-auto" /> : <Unlock size={11} className="text-app-muted-foreground opacity-30 mx-auto" />
          else if (col.key === 'isVerified') cellContent = entry.is_verified ? <ShieldCheck size={11} className="text-app-success mx-auto" /> : <span className="opacity-30">—</span>
          else if (col.key === 'date') cellContent = <>{dateStr}{entry.fiscalYear && <div className="text-[9px] text-app-muted-foreground">{entry.fiscalYear.name}</div>}</>
          else if (col.key === 'fiscalYear') cellContent = entry.fiscal_year?.name || entry.fiscalYear?.name || '—'
          else if (col.key === 'fiscalPeriod') cellContent = entry.fiscal_period?.name || '—'
          else if (col.key === 'postedAt') cellContent = entry.posted_at ? new Date(entry.posted_at).toLocaleDateString('en-GB') : '—'
          else if (col.key === 'createdAt') cellContent = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-GB') : '—'
          else if (col.key === 'updatedAt') cellContent = entry.updated_at ? new Date(entry.updated_at).toLocaleDateString('en-GB') : '—'
          else if (col.key === 'createdBy') cellContent = <span className="truncate">{entry.created_by?.first_name || entry.created_by?.username || '—'}</span>
          else if (col.key === 'postedBy') cellContent = <span className="truncate">{entry.posted_by?.first_name || entry.posted_by?.username || '—'}</span>
          else if (col.key === 'entryHash') cellContent = entry.entry_hash ? <span className="font-mono text-[8px] truncate opacity-60">{entry.entry_hash.slice(0, 12)}…</span> : '—'
          else if (col.key === 'site') cellContent = <span className="truncate">{entry.site?.name || '—'}</span>
          return <div key={col.key} className={`${w} flex-shrink-0${align} text-[11px] font-bold text-app-foreground`}>{cellContent}</div>
        })}
      </div>

      {/* Detail Row */}
      {isOpen && (
        <div className="border-b border-app-border/30 animate-in slide-in-from-top-1 duration-200"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, var(--app-bg))' }}>
          <div className="sticky left-0 px-4 py-3" style={{ width: 'min(100vw - 280px, 100%)' }}>
            {/* Action bar */}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => onView(entry.id)}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
                <Eye size={11} /> View Details
              </button>
              {entry.status !== 'REVERSED' && !isLocked && (
                <button onClick={() => { window.location.href = `/finance/ledger/${entry.id}/edit` }}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                  <Edit size={11} /> Edit
                </button>
              )}
              <LedgerEntryActions entryId={entry.id} status={entry.status} isLocked={isLocked} />
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Summary */}
              <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                  style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                  <div className="w-1 h-3 rounded-full bg-app-primary" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-app-primary">Summary</span>
                </div>
                <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
                  <DCell label="JV ID" value={`#${entry.id}`} mono color="var(--app-primary)" />
                  <DCell label="Reference" value={entry.reference} mono />
                  <DCell label="Status" value={sc.label} color={sc.color} />
                  <DCell label="Date" value={dateStr} />
                  <DCell label="Fiscal Year" value={entry.fiscalYear?.name} />
                  <DCell label="Lines" value={lines.length} />
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                  style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
                  <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-success)' }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>Totals</span>
                </div>
                <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
                  <DCell label="Total Debit" value={fmt(totalDebit)} mono color="var(--app-primary)" />
                  <DCell label="Total Credit" value={fmt(totalCredit)} mono color="var(--app-error)" />
                  <DCell label="Balance" value={fmt(Math.abs(totalDebit - totalCredit))} mono
                    color={totalDebit === totalCredit ? 'var(--app-success)' : 'var(--app-error)'} />
                </div>
              </div>
            </div>

            {/* Journal Lines Table */}
            {lines.length > 0 && (
              <div className="mt-2.5 rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                  style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)' }}>
                  <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-info)' }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Financial Vectors</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5 border-b border-app-border/20 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">
                  <div className="w-16">Code</div>
                  <div className="flex-1">Account</div>
                  <div className="w-24 text-right">Debit</div>
                  <div className="w-24 text-right">Credit</div>
                </div>
                {lines.map((l: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-b border-app-border/10 hover:bg-app-surface/40 transition-all">
                    <div className="w-16">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {l.account?.code}
                      </span>
                    </div>
                    <div className="flex-1 text-[11px] font-bold text-app-foreground truncate">{l.account?.name}</div>
                    <div className="w-24 text-right text-[11px] font-mono font-bold tabular-nums"
                      style={{ color: Number(l.debit) > 0 ? 'var(--app-primary)' : 'transparent' }}>
                      {Number(l.debit) > 0 ? fmt(Number(l.debit)) : ''}
                    </div>
                    <div className="w-24 text-right text-[11px] font-mono font-bold tabular-nums"
                      style={{ color: Number(l.credit) > 0 ? 'var(--app-error)' : 'transparent' }}>
                      {Number(l.credit) > 0 ? fmt(Number(l.credit)) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
