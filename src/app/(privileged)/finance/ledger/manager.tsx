'use client'

/**
 * General Ledger Manager — DajingoListView Migration
 * =====================================================
 * Uses the universal DajingoListView table template.
 */

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import { useCurrency } from '@/lib/utils/currency'
import { getLedgerEntries, deleteJournalEntry, bulkDeleteJournalEntries } from '@/app/actions/finance/ledger'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import Link from 'next/link'
import {
  Search, FileText, Layers, Eye, Edit, Trash2,
  X, Maximize2, Minimize2,
  SlidersHorizontal, RefreshCcw,
  ShieldCheck, Clock, Zap, Lock, Unlock, RotateCcw,
  BookOpen,
} from 'lucide-react'

/* ── Shared UI ── */
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { DCell } from '@/components/ui/DCell'

/* ── Local lib ── */
import type { JournalEntry, LedgerFilters, Lookups } from './_lib/types'
import {
  ALL_COLUMNS, ALL_FILTERS, STATUS_CONFIG,
  DEFAULT_VISIBLE_FILTERS,
  EMPTY_FILTERS, toArr,
} from './_lib/constants'

/* ── Local components ── */
import { LedgerFiltersPanel } from './_components/LedgerFiltersPanel'
import { NewEntryDropdown } from './_components/NewEntryDropdown'
import { LedgerEntryActions } from './ledger-actions'

/* ── Column layout config ── */
const COLUMN_WIDTHS: Record<string, string> = {
  reference: 'w-24', journalType: 'w-20', scope: 'w-14',
  sourceModule: 'w-20', sourceModel: 'w-24', sourceId: 'w-14',
  totalDebit: 'w-24', totalCredit: 'w-24', lineCount: 'w-14',
  currency: 'w-14', exchangeRate: 'w-16',
  isLocked: 'w-14', isVerified: 'w-14',
  date: 'w-24', fiscalYear: 'w-20', fiscalPeriod: 'w-20',
  postedAt: 'w-20', createdAt: 'w-20', updatedAt: 'w-20',
  createdBy: 'w-20', postedBy: 'w-20', entryHash: 'w-20', site: 'w-20',
  status: 'w-20',
}
const RIGHT_ALIGNED_COLS = new Set(['totalDebit', 'totalCredit', 'lineCount', 'sourceId', 'exchangeRate'])
const CENTER_ALIGNED_COLS = new Set(['isLocked', 'isVerified'])
const GROW_COLS = new Set(['totalDebit', 'totalCredit', 'reference', 'sourceModel', 'site'])

/* ═══════════════════════════════════════════════════════════
 *  COLUMN CELL RENDERER
 * ═══════════════════════════════════════════════════════════ */
function renderLedgerCell(key: string, e: JournalEntry, fmt: (n: number) => string): React.ReactNode {
  const sc = STATUS_CONFIG[e.status] || { label: e.status, color: 'var(--app-muted-foreground)' }
  const lines = e.lines || []

  switch (key) {
    case 'reference': return <span className="font-mono text-[10px] text-app-muted-foreground">{e.reference || '—'}</span>
    case 'journalType': return <span className="text-[10px] text-app-foreground">{e.journal_type || e.journalType || '—'}</span>
    case 'scope':
      return e.scope === 'OFFICIAL'
        ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>OFF</span>
        : <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>INT</span>
    case 'sourceModule': return <span className="text-[10px] text-app-muted-foreground">{e.source_module || '—'}</span>
    case 'sourceModel': return <span className="text-[10px] text-app-muted-foreground truncate">{e.source_model || '—'}</span>
    case 'sourceId': return <span className="text-[10px] font-mono text-app-muted-foreground">{e.source_id || '—'}</span>
    case 'totalDebit': {
      const total = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
      return <span className="font-mono tabular-nums text-[11px]" style={total > 0 ? { color: 'var(--app-primary)' } : undefined}>{total > 0 ? fmt(total) : '—'}</span>
    }
    case 'totalCredit': {
      const total = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
      return <span className="font-mono tabular-nums text-[11px]" style={total > 0 ? { color: 'var(--app-error)' } : undefined}>{total > 0 ? fmt(total) : '—'}</span>
    }
    case 'lineCount': return <span className="text-[11px] font-bold text-app-foreground">{lines.length}</span>
    case 'currency': return <span className="text-[10px] text-app-muted-foreground">{e.currency || '—'}</span>
    case 'exchangeRate': return <span className="text-[10px] font-mono text-app-muted-foreground">{e.exchange_rate ? Number(e.exchange_rate).toFixed(4) : '—'}</span>
    case 'isLocked': return e.is_locked ? <Lock size={11} className="text-app-warning mx-auto" /> : <Unlock size={11} className="text-app-muted-foreground opacity-30 mx-auto" />
    case 'isVerified': return e.is_verified ? <ShieldCheck size={11} className="text-app-success mx-auto" /> : <span className="opacity-30">—</span>
    case 'date': return <><span className="text-[11px] text-app-muted-foreground">{e.transactionDate ? new Date(e.transactionDate).toLocaleDateString('en-GB') : '—'}</span>{e.fiscalYear && <div className="text-[9px] text-app-muted-foreground">{e.fiscalYear.name}</div>}</>
    case 'fiscalYear': return <span className="text-[10px] text-app-muted-foreground">{e.fiscal_year?.name || e.fiscalYear?.name || '—'}</span>
    case 'fiscalPeriod': return <span className="text-[10px] text-app-muted-foreground">{e.fiscal_period?.name || '—'}</span>
    case 'postedAt': return <span className="text-[10px] text-app-muted-foreground">{e.posted_at ? new Date(e.posted_at).toLocaleDateString('en-GB') : '—'}</span>
    case 'createdAt': return <span className="text-[10px] text-app-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleDateString('en-GB') : '—'}</span>
    case 'updatedAt': return <span className="text-[10px] text-app-muted-foreground">{e.updated_at ? new Date(e.updated_at).toLocaleDateString('en-GB') : '—'}</span>
    case 'createdBy': return <span className="text-[10px] text-app-muted-foreground truncate">{e.created_by?.first_name || e.created_by?.username || '—'}</span>
    case 'postedBy': return <span className="text-[10px] text-app-muted-foreground truncate">{e.posted_by?.first_name || e.posted_by?.username || '—'}</span>
    case 'entryHash': return e.entry_hash ? <span className="font-mono text-[8px] truncate opacity-60">{e.entry_hash.slice(0, 12)}…</span> : <span>—</span>
    case 'site': return <span className="text-[10px] text-app-muted-foreground truncate">{e.site?.name || '—'}</span>
    case 'status':
      return (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
          {sc.label}
        </span>
      )
    default: return <span className="text-[10px] text-app-muted-foreground">—</span>
  }
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
const EMPTY_LOOKUPS: Lookups = { fiscalYears: [], users: [] }

export default function LedgerManager({ initialEntries, lookups = EMPTY_LOOKUPS }: { initialEntries?: any; lookups?: Lookups }) {
  const router = useRouter()
  const { fmt } = useCurrency()
  const { viewScope } = useAdmin()
  const safeInitial = toArr(initialEntries)
  const [items, setItems] = useState<JournalEntry[]>(safeInitial)
  const [loading, setLoading] = useState(safeInitial.length === 0)
  const [search, setSearch] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS)
  const [visibleFilters, setVisibleFilters] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_FILTERS)
  const searchRef = useRef<HTMLInputElement>(null)

  // Column visibility & ordering
  const defaultVC: Record<string, boolean> = {}
  ALL_COLUMNS.forEach(c => { defaultVC[c.key] = c.defaultVisible })
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVC)
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showSingleDelete, setShowSingleDelete] = useState<number | null>(null)
  const toggleSelect = (id: number | string) => {
    const next = new Set(selectedIds)
    if (next.has(id as number)) next.delete(id as number); else next.add(id as number)
    setSelectedIds(next)
  }

  // ── SaaS ListViewPolicy enforcement ──
  const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
  useEffect(() => {
    getListViewPolicy('finance.ledger').then(policy => {
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
      const data = await getLedgerEntries(viewScope || 'INTERNAL', {})
      setItems(toArr(data))
    } catch { /* empty */ }
    setLoading(false)
  }, [viewScope])

  useEffect(() => { if (safeInitial.length === 0) fetchData() }, [fetchData, safeInitial.length])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length
  }, [filters])

  // Apply all filters + search
  const filtered = useMemo(() => {
    return toArr(items).filter(e => {
      if (search) {
        const q = search.toLowerCase()
        const match = (e.description || '').toLowerCase().includes(q) ||
          (e.reference || '').toLowerCase().includes(q) ||
          String(e.id).includes(q)
        if (!match) return false
      }
      if (filters.status && e.status !== filters.status) return false
      if (filters.entryType) {
        if (filters.entryType === 'MANUAL' && e.source_module) return false
        if (filters.entryType === 'AUTO' && !e.source_module) return false
      }
      if (filters.journalType && (e.journal_type || e.journalType) !== filters.journalType) return false
      if (filters.scope && e.scope !== filters.scope) return false
      if (filters.fiscalYear && String(e.fiscalYear?.id || e.fiscal_year?.id || e.fiscal_year) !== filters.fiscalYear) return false
      if (filters.autoSource && (e.source_module || e.autoSource) !== filters.autoSource) return false
      if (filters.isLocked === 'yes' && !e.is_locked) return false
      if (filters.isLocked === 'no' && e.is_locked) return false
      if (filters.isVerified === 'yes' && !e.is_verified) return false
      if (filters.isVerified === 'no' && e.is_verified) return false
      if (filters.sourceModule && (e.source_module || '') !== filters.sourceModule) return false
      if (filters.dateFrom && e.transactionDate < filters.dateFrom) return false
      if (filters.dateTo && e.transactionDate > filters.dateTo) return false
      return true
    })
  }, [items, search, filters])

  const hasFilters = !!search || activeFilterCount > 0

  // Stats
  const stats = useMemo(() => {
    const safe = toArr(items)
    const total = safe.length
    const posted = safe.filter(e => e.status === 'POSTED').length
    const draft = safe.filter(e => e.status === 'DRAFT').length
    const reversed = safe.filter(e => e.status === 'REVERSED').length
    const auto = safe.filter(e => !!e.source_module).length
    return { total, posted, draft, reversed, auto }
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

  // ── Delete handlers ──
  const handleSingleDelete = async (id: number) => {
    startTransition(async () => {
      try {
        await deleteJournalEntry(id)
        toast.success('Journal entry deleted')
        setItems(prev => prev.filter(e => e.id !== id))
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })
    setShowSingleDelete(null)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    // Only delete non-POSTED entries
    const deletable = ids.filter(id => {
      const entry = items.find(e => e.id === id)
      return entry && entry.status !== 'POSTED'
    })
    if (deletable.length === 0) {
      toast.error('No deletable entries selected (POSTED entries cannot be deleted)')
      setShowBulkDelete(false)
      return
    }
    startTransition(async () => {
      try {
        const results = await bulkDeleteJournalEntries(deletable)
        const succeeded = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success)
        if (succeeded > 0) toast.success(`${succeeded} entr${succeeded === 1 ? 'y' : 'ies'} deleted`)
        if (failed.length > 0) toast.error(`${failed.length} entr${failed.length === 1 ? 'y' : 'ies'} failed to delete`)
        const deletedIds = new Set(results.filter(r => r.success).map(r => r.id))
        setItems(prev => prev.filter(e => !deletedIds.has(e.id)))
        setSelectedIds(new Set())
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })
    setShowBulkDelete(false)
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 transition-all">
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

        {focusMode ? (
          /* ── FOCUS MODE ── */
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                <FileText size={14} className="text-white" />
              </div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Ledger</span>
              <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{stats.total}</span>
            </div>
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all flex-shrink-0 ${showFilters ? 'border-app-primary text-app-primary bg-app-primary/5' : 'border-app-border text-app-muted-foreground'}`}>
              <SlidersHorizontal size={13} />
              {activeFilterCount > 0 && <span className="text-[9px] font-black bg-app-primary text-white px-1.5 rounded-full">{activeFilterCount}</span>}
            </button>
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
                  <FileText size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">General Ledger</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    {stats.total} Entries · {stats.posted} Posted · {stats.reversed} Reversed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {selectedIds.size > 0 && (
                  <button onClick={() => setShowBulkDelete(true)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50">
                    <Trash2 size={13} />
                    <span>Delete {selectedIds.size}</span>
                  </button>
                )}
                <Link href="/finance/ledger/opening"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <BookOpen size={13} /><span className="hidden md:inline">Opening Balances</span>
                </Link>
                <NewEntryDropdown />
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
              { label: 'Reversed', value: stats.reversed, icon: <RotateCcw size={11} />, color: 'var(--app-error, #ef4444)' },
              { label: 'Automated', value: stats.auto, icon: <Zap size={11} />, color: '#8b5cf6' },
            ]} />

            <LedgerFiltersPanel filters={filters} setFilters={setFilters} isOpen={showFilters} lookups={lookups} visibleFilters={visibleFilters} />
          </>
        )}

        {focusMode && <LedgerFiltersPanel filters={filters} setFilters={setFilters} isOpen={showFilters} lookups={lookups} visibleFilters={visibleFilters} />}
      </div>

      {/* ═══════════════ TABLE (DajingoListView) ═══════════════ */}
      <DajingoListView<JournalEntry>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={e => e.id}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_ALIGNED_COLS}
        centerAlignedCols={CENTER_ALIGNED_COLS}
        growCols={GROW_COLS}
        columnOrder={columnOrder}
        onColumnReorder={setColumnOrder}
        policyHiddenColumns={policyHiddenColumns}
        entityLabel="Journal Entry"
        /* ── Integrated Toolbar ── */
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by reference, narrative, or JV ID... (Ctrl+K)"
        searchRef={searchRef as React.RefObject<HTMLInputElement>}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        activeFilterCount={activeFilterCount}
        onSetVisibleColumns={setVisibleColumns}
        onSetColumnOrder={setColumnOrder}
        moduleKey="finance.ledger"
        allFilters={ALL_FILTERS}
        visibleFilters={visibleFilters}
        onSetVisibleFilters={setVisibleFilters}
        /* ── Row rendering ── */
        renderRowIcon={entry => {
          const sc = STATUS_CONFIG[entry.status] || { label: entry.status, color: 'var(--app-muted-foreground)' }
          return (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
              {entry.source_module ? <Zap size={13} /> : <FileText size={13} />}
            </div>
          )
        }}
        renderRowTitle={entry => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">JV #{entry.id}</div>
            <div className="text-[10px] text-app-muted-foreground truncate">{entry.description || entry.reference || '—'}</div>
          </div>
        )}
        renderColumnCell={(key, entry) => renderLedgerCell(key, entry, fmt)}
        renderExpanded={entry => <LedgerExpandedRow entry={entry} fmt={fmt} onView={(id) => router.push(`/finance/ledger/${id}`)} onDeleted={fetchData} />}
        onView={entry => router.push(`/finance/ledger/${entry.id}`)}
        menuActions={entry => {
          const isLocked = entry.fiscalYear?.status === 'LOCKED' || entry.fiscalYear?.isLocked
          const actions = []
          if (entry.status !== 'REVERSED' && !isLocked) {
            actions.push({ label: 'Edit Entry', icon: <Edit size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/finance/ledger/${entry.id}/edit` } })
          }
          if (entry.status !== 'POSTED' && !isLocked) {
            actions.push({ label: 'Delete Entry', icon: <Trash2 size={12} className="text-rose-500" />, onClick: () => setShowSingleDelete(entry.id), variant: 'destructive' as const })
          }
          return actions
        }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        isAllPageSelected={isAllPageSelected}
        onToggleSelectAll={toggleSelectAll}
        hasFilters={hasFilters}
        onClearFilters={() => { setSearch(''); setFilters(EMPTY_FILTERS) }}
        emptyIcon={<FileText size={36} />}
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

      {/* ── Confirm Dialogs ── */}
      <ConfirmDialog
        open={showSingleDelete !== null}
        onOpenChange={(open) => { if (!open) setShowSingleDelete(null) }}
        onConfirm={() => { if (showSingleDelete !== null) handleSingleDelete(showSingleDelete) }}
        title="Delete Journal Entry?"
        description={`This will permanently delete journal entry JV #${showSingleDelete} and all its lines. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} Journal ${selectedIds.size === 1 ? 'Entry' : 'Entries'}?`}
        description={`This will permanently delete the selected entries and all their lines. POSTED entries will be skipped. This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />
    </div>
  )
}

/* ── Ledger Expanded Row ── */
function LedgerExpandedRow({ entry, fmt, onView, onDeleted }: { entry: JournalEntry; fmt: (n: number) => string; onView: (id: number) => void; onDeleted?: () => void }) {
  const sc = STATUS_CONFIG[entry.status] || { label: entry.status, color: 'var(--app-muted-foreground)' }
  const lines = entry.lines || []
  const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
  const isLocked = entry.fiscalYear?.status === 'LOCKED' || entry.fiscalYear?.isLocked
  const dateStr = entry.transactionDate ? new Date(entry.transactionDate).toLocaleDateString('en-GB') : '—'

  return (
    <div className="px-4 py-3">
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
        <LedgerEntryActions entryId={entry.id} status={entry.status} isLocked={isLocked} onDeleted={onDeleted} />
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
  )
}
