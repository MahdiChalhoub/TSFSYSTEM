'use client'

/**
 * Opening Balances Manager — DajingoListView
 * =============================================
 * Independent page for managing opening balance journal entries.
 * Uses the universal DajingoListView table template (same as Products).
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/utils/currency'
import { getOpeningEntries } from '@/app/actions/finance/ledger'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import Link from 'next/link'
import {
  Search, FileText, Layers, Eye, Edit,
  X, Maximize2, Minimize2,
  SlidersHorizontal, RefreshCcw,
  ShieldCheck, Clock, RotateCcw,
  BookOpen, Plus, Upload, Calendar, Hash,
} from 'lucide-react'

/* ── Shared UI ── */
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView } from '@/components/common/DajingoListView'
import { DCell } from '@/components/ui/DCell'

/* ── Local lib ── */
import {
  ALL_COLUMNS, COLUMN_WIDTHS, RIGHT_COLS, CENTER_COLS, GROW_COLS,
  STATUS_CONFIG, DEFAULT_VISIBLE_COLS, toArr,
  type OpeningEntry,
} from './_lib/constants'

/* ═══════════════════════════════════════════════════════════
 *  COLUMN CELL RENDERER
 * ═══════════════════════════════════════════════════════════ */
function renderCell(key: string, e: OpeningEntry, fmt: (n: number) => string): React.ReactNode {
  const status = e.status ?? 'DRAFT'
  const sc = STATUS_CONFIG[status] || { label: status, color: 'var(--app-muted-foreground)' }
  const lines = e.lines || []

  switch (key) {
    case 'reference':
      return <span className="font-mono text-[10px] text-app-muted-foreground">{e.reference || '—'}</span>
    case 'date': {
      const d = e.transactionDate || e.transaction_date
      return (
        <>
          <span className="text-[11px] text-app-muted-foreground">
            {d ? new Date(d).toLocaleDateString('en-GB') : '—'}
          </span>
          {e.fiscalYear && <div className="text-[9px] text-app-muted-foreground">{e.fiscalYear.name}</div>}
        </>
      )
    }
    case 'status':
      return (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
          {sc.label}
        </span>
      )
    case 'lineCount':
      return <span className="text-[11px] font-bold text-app-foreground">{lines.length}</span>
    case 'totalDebit': {
      const total = lines.reduce((s: number, l) => s + (Number(l.debit) || 0), 0)
      return <span className="font-mono tabular-nums text-[11px]" style={total > 0 ? { color: 'var(--app-primary)' } : undefined}>{total > 0 ? fmt(total) : '—'}</span>
    }
    case 'totalCredit': {
      const total = lines.reduce((s: number, l) => s + (Number(l.credit) || 0), 0)
      return <span className="font-mono tabular-nums text-[11px]" style={total > 0 ? { color: 'var(--app-error)' } : undefined}>{total > 0 ? fmt(total) : '—'}</span>
    }
    case 'fiscalYear':
      return <span className="text-[10px] text-app-muted-foreground">{e.fiscal_year?.name || e.fiscalYear?.name || '—'}</span>
    case 'createdBy':
      return <span className="text-[10px] text-app-muted-foreground truncate">{e.created_by?.first_name || e.created_by?.username || e.createdBy || '—'}</span>
    case 'createdAt':
      return <span className="text-[10px] text-app-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleDateString('en-GB') : '—'}</span>
    case 'scope':
      return e.scope === 'OFFICIAL'
        ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>OFF</span>
        : <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>INT</span>
    default:
      return <span className="text-[10px] text-app-muted-foreground">—</span>
  }
}

/* ═══════════════════════════════════════════════════════════
 *  EXPANDED ROW
 * ═══════════════════════════════════════════════════════════ */
function OpeningExpandedRow({ entry, fmt, onView }: { entry: OpeningEntry; fmt: (n: number) => string; onView: (id: number) => void }) {
  const status = entry.status ?? 'DRAFT'
  const sc = STATUS_CONFIG[status] || { label: status, color: 'var(--app-muted-foreground)' }
  const lines = entry.lines || []
  const totalDebit = lines.reduce((s: number, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s: number, l) => s + (Number(l.credit) || 0), 0)
  const d2 = entry.transactionDate || entry.transaction_date
  const dateStr = d2 ? new Date(d2).toLocaleDateString('en-GB') : '—'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => onView(entry.id)}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
          <Eye size={11} /> View Details
        </button>
        {entry.status !== 'REVERSED' && (
          <button onClick={() => { window.location.href = `/finance/ledger/${entry.id}/edit` }}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
            <Edit size={11} /> Edit
          </button>
        )}
      </div>

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
            <DCell label="Fiscal Year" value={entry.fiscalYear?.name || entry.fiscal_year?.name} />
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

      {/* Account Lines Table */}
      {lines.length > 0 && (
        <div className="mt-2.5 rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
          <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
            style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)' }}>
            <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-info)' }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Account Balances</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-app-border/20 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">
            <div className="w-16">Code</div>
            <div className="flex-1">Account</div>
            <div className="w-24 text-right">Debit</div>
            <div className="w-24 text-right">Credit</div>
          </div>
          {lines.map((l, i: number) => (
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
          {/* Total row */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-app-border/30"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
            <div className="w-16" />
            <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Total</div>
            <div className="w-24 text-right text-[11px] font-mono font-black tabular-nums" style={{ color: 'var(--app-primary)' }}>
              {fmt(totalDebit)}
            </div>
            <div className="w-24 text-right text-[11px] font-mono font-black tabular-nums" style={{ color: 'var(--app-error)' }}>
              {fmt(totalCredit)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export default function OpeningBalancesManager() {
  const router = useRouter()
  const { fmt } = useCurrency()
  const [items, setItems] = useState<OpeningEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Column visibility & ordering
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_COLS)
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const toggleSelect = (id: number | string) => {
    const next = new Set(selectedIds)
    if (next.has(id as number)) next.delete(id as number); else next.add(id as number)
    setSelectedIds(next)
  }

  // SaaS ListViewPolicy enforcement
  const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
  useEffect(() => {
    getListViewPolicy('finance.opening-balances').then(policy => {
      if (policy?.hidden_columns?.length) setPolicyHiddenColumns(new Set(policy.hidden_columns))
    }).catch(() => {})
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getOpeningEntries()
      setItems(toArr(data))
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Apply search + status filter
  const filtered = useMemo(() => {
    return toArr<OpeningEntry>(items).filter(e => {
      if (search) {
        const q = search.toLowerCase()
        const match = (e.description || '').toLowerCase().includes(q) ||
          (e.reference || '').toLowerCase().includes(q) ||
          String(e.id).includes(q)
        if (!match) return false
      }
      if (statusFilter && e.status !== statusFilter) return false
      return true
    })
  }, [items, search, statusFilter])

  const activeFilterCount = [statusFilter].filter(Boolean).length
  const hasFilters = !!search || activeFilterCount > 0

  // Stats
  const stats = useMemo(() => {
    const safe = toArr<OpeningEntry>(items)
    const total = safe.length
    const posted = safe.filter(e => e.status === 'POSTED').length
    const draft = safe.filter(e => e.status === 'DRAFT').length
    const totalDebit = safe.reduce((sum, e) => {
      const lines = e.lines || []
      return sum + lines.reduce((s: number, l) => s + (Number(l.debit) || 0), 0)
    }, 0)
    const totalCredit = safe.reduce((sum, e) => {
      const lines = e.lines || []
      return sum + lines.reduce((s: number, l) => s + (Number(l.credit) || 0), 0)
    }, 0)
    const totalLines = safe.reduce((sum, e) => sum + (e.lines?.length || 0), 0)
    return { total, posted, draft, totalDebit, totalCredit, totalLines }
  }, [items])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  const isAllPageSelected = paginated.length > 0 && paginated.every(e => selectedIds.has(e.id))
  const toggleSelectAll = () => {
    if (isAllPageSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map(e => e.id)))
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 transition-all">
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

        {focusMode ? (
          /* ── FOCUS MODE ── */
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                <BookOpen size={14} className="text-white" />
              </div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Opening Balances</span>
              <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{stats.total}</span>
            </div>
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all" />
            </div>
            <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
              <Minimize2 size={13} />
            </button>
          </div>
        ) : (
          /* ── NORMAL MODE ── */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <BookOpen size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Opening Balances</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    {stats.total} Entries · {stats.totalLines} Account Lines · {stats.posted} Posted
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <Link href="/finance/ledger"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <FileText size={13} /><span className="hidden md:inline">General Ledger</span>
                </Link>
                <Link href="/finance/ledger/opening"
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /><span className="hidden sm:inline">New Opening Balance</span>
                </Link>
                <button onClick={fetchData} title="Refresh"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <RefreshCcw size={13} />
                </button>
                <button onClick={() => setFocusMode(true)} title="Focus mode — Ctrl+Q"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            <KPIStrip stats={[
              { label: 'Total Entries', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-info)' },
              { label: 'Posted', value: stats.posted, icon: <ShieldCheck size={11} />, color: 'var(--app-success)' },
              { label: 'Draft', value: stats.draft, icon: <Clock size={11} />, color: 'var(--app-warning)' },
              { label: 'Total Debit', value: fmt(stats.totalDebit), icon: <Hash size={11} />, color: 'var(--app-primary)' },
              { label: 'Total Credit', value: fmt(stats.totalCredit), icon: <Hash size={11} />, color: 'var(--app-error, #ef4444)' },
            ]} />
          </>
        )}
      </div>

      {/* ═══════════════ TABLE (DajingoListView) ═══════════════ */}
      <DajingoListView<OpeningEntry>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={e => e.id}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_COLS}
        centerAlignedCols={CENTER_COLS}
        growCols={GROW_COLS}
        columnOrder={columnOrder}
        onColumnReorder={setColumnOrder}
        policyHiddenColumns={policyHiddenColumns}
        entityLabel="Opening Balance"
        /* ── Integrated Toolbar ── */
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by reference, description, or ID... (Ctrl+K)"
        searchRef={searchRef as React.RefObject<HTMLInputElement>}
        onSetVisibleColumns={setVisibleColumns}
        onSetColumnOrder={setColumnOrder}
        moduleKey="finance.opening-balances"
        /* ── Row rendering ── */
        renderRowIcon={entry => {
          const status = entry.status ?? 'DRAFT'
          const sc = STATUS_CONFIG[status] || { label: status, color: 'var(--app-muted-foreground)' }
          return (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
              <BookOpen size={13} />
            </div>
          )
        }}
        renderRowTitle={entry => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">Opening #{entry.id}</div>
            <div className="text-[10px] text-app-muted-foreground truncate">{entry.description || entry.reference || '—'}</div>
          </div>
        )}
        renderColumnCell={(key, entry) => renderCell(key, entry, fmt)}
        renderExpanded={entry => <OpeningExpandedRow entry={entry} fmt={fmt} onView={(id) => router.push(`/finance/ledger/${id}`)} />}
        onView={entry => router.push(`/finance/ledger/${entry.id}`)}
        menuActions={entry => {
          const actions = []
          if (entry.status !== 'REVERSED') {
            actions.push({ label: 'Edit Entry', icon: <Edit size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/finance/ledger/${entry.id}/edit` } })
          }
          return actions
        }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        isAllPageSelected={isAllPageSelected}
        onToggleSelectAll={toggleSelectAll}
        hasFilters={hasFilters}
        onClearFilters={() => { setSearch(''); setStatusFilter('') }}
        emptyIcon={<BookOpen size={36} />}
        emptyMessage="No opening balance entries found. Create one to set initial account balances."
        pagination={{
          totalItems: filtered.length,
          activeFilterCount,
          currentPage: clampedPage,
          totalPages,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: n => { setPageSize(n); setCurrentPage(1) },
        }}
      />
    </div>
  )
}
