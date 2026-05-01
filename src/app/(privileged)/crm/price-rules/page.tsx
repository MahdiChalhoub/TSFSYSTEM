'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Percent } from 'lucide-react'

interface PriceRule {
  id: number
  name?: string
  description?: string
  type?: string
  rule_type?: string
  value?: number | string
  discount_value?: number | string
  is_active?: boolean
  [key: string]: unknown
}

interface ListResponse<T> {
  results?: T[]
}

const ALL_COLUMNS: DajingoColumnDef[] = [
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'value', label: 'Value', defaultVisible: true },
  { key: 'active', label: 'Active', defaultVisible: true },
  { key: 'id', label: 'ID', defaultVisible: false },
]
const COLUMN_WIDTHS: Record<string, string> = { name: 'w-32', type: 'w-20', value: 'w-20', active: 'w-16', id: 'w-12' }
const RIGHT_ALIGNED_COLS = new Set(['value'])

export default function PriceRulesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))
  const searchRef = useRef<HTMLInputElement>(null as unknown as HTMLInputElement)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const data = (await erpFetch('crm/price-rules/')) as PriceRule[] | ListResponse<PriceRule>
        setItems(Array.isArray(data) ? data : (data?.results || []))
      } catch { setItems([]) }
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(r => JSON.stringify(r).toLowerCase().includes(q))
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      <div className="flex-shrink-0 space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="page-header-icon" style={{ background: 'var(--app-warning)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
              <Percent size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Price Rules</h1>
              <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                {items.length} Rules
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/crm/price-rules/new')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white px-4 py-2 rounded-xl shadow-lg transition-all hover:brightness-110"
            style={{ background: 'var(--app-primary)' }}>
            <Plus size={14} /> New Rule
          </button>
        </div>
      </div>

      <DajingoListView<PriceRule>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={r => r.id}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_ALIGNED_COLS}
        columnOrder={columnOrder}
        onColumnReorder={setColumnOrder}
        entityLabel="Price Rule"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search price rules... (Ctrl+K)"
        searchRef={searchRef}
        hasFilters={!!search}
        onClearFilters={() => setSearch('')}
        onSetVisibleColumns={setVisibleColumns}
        onSetColumnOrder={setColumnOrder}
        moduleKey="crm.price_rules"
        renderRowIcon={() => (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
            <Percent size={13} />
          </div>
        )}
        renderRowTitle={r => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{r.name || `Rule #${r.id}`}</div>
            <div className="text-[10px] text-app-muted-foreground">{r.description || r.type || '—'}</div>
          </div>
        )}
        renderColumnCell={(key, r) => {
          switch (key) {
            case 'name': return <span className="text-[11px] font-bold text-app-foreground">{r.name || '—'}</span>
            case 'type': return <span className="text-[10px] font-bold text-app-muted-foreground uppercase">{r.type || r.rule_type || '—'}</span>
            case 'value': return <span className="text-[12px] font-mono font-bold tabular-nums text-app-foreground">{r.value ?? r.discount_value ?? '—'}</span>
            case 'active': return (
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${r.is_active !== false ? 'text-app-success' : 'text-app-muted-foreground'}`}
                style={{ background: r.is_active !== false ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)' }}>
                {r.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            )
            case 'id': return <span className="text-[10px] text-app-muted-foreground font-mono">#{r.id}</span>
            default: return <span className="text-[10px] text-app-muted-foreground">—</span>
          }
        }}
        onView={r => router.push(`/crm/price-rules/${r.id}`)}
        menuActions={r => [
          { label: 'Edit', icon: <Percent size={12} className="text-app-muted-foreground" />, onClick: () => router.push(`/crm/price-rules/${r.id}/edit`) },
        ]}
        emptyIcon={<Percent size={36} />}
        pagination={{
          totalItems: filtered.length,
          activeFilterCount: 0,
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
