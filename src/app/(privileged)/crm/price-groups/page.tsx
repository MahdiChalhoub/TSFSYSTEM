'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Tag } from 'lucide-react'

interface PriceGroup {
  id: number
  name?: string
  description?: string
  discount?: number | string
  discount_percentage?: number | string
  contacts?: unknown[]
  contacts_count?: number
  [key: string]: unknown
}

interface ListResponse<T> {
  results?: T[]
}

const ALL_COLUMNS: DajingoColumnDef[] = [
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'discount', label: 'Discount %', defaultVisible: true },
  { key: 'contacts', label: 'Contacts', defaultVisible: true },
  { key: 'id', label: 'ID', defaultVisible: false },
]
const COLUMN_WIDTHS: Record<string, string> = { name: 'w-32', discount: 'w-20', contacts: 'w-20', id: 'w-12' }
const RIGHT_ALIGNED_COLS = new Set(['discount'])

export default function PriceGroupsListPage() {
  const router = useRouter()
  const [items, setItems] = useState<PriceGroup[]>([])
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
        const data = (await erpFetch('crm/price-groups/')) as PriceGroup[] | ListResponse<PriceGroup>
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
            <div className="page-header-icon" style={{ background: 'var(--app-accent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-accent) 30%, transparent)' }}>
              <Tag size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Price Groups</h1>
              <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                {items.length} Groups
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/crm/price-groups/new')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white px-4 py-2 rounded-xl shadow-lg transition-all hover:brightness-110"
            style={{ background: 'var(--app-primary)' }}>
            <Plus size={14} /> New Group
          </button>
        </div>
      </div>

      <DajingoListView<PriceGroup>
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
        entityLabel="Price Group"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search price groups... (Ctrl+K)"
        searchRef={searchRef}
        hasFilters={!!search}
        onClearFilters={() => setSearch('')}
        onSetVisibleColumns={setVisibleColumns}
        onSetColumnOrder={setColumnOrder}
        moduleKey="crm.price_groups"
        renderRowIcon={() => (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)', color: 'var(--app-accent)' }}>
            <Tag size={13} />
          </div>
        )}
        renderRowTitle={r => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{r.name || `Group #${r.id}`}</div>
            <div className="text-[10px] text-app-muted-foreground">{r.description || '—'}</div>
          </div>
        )}
        renderColumnCell={(key, r) => {
          switch (key) {
            case 'name': return <span className="text-[11px] font-bold text-app-foreground">{r.name || '—'}</span>
            case 'discount': return <span className="text-[12px] font-mono font-bold tabular-nums text-app-foreground">{r.discount_percentage ?? r.discount ?? '—'}%</span>
            case 'contacts': return <span className="text-[11px] text-app-muted-foreground">{r.contacts_count ?? r.contacts?.length ?? '—'}</span>
            case 'id': return <span className="text-[10px] text-app-muted-foreground font-mono">#{r.id}</span>
            default: return <span className="text-[10px] text-app-muted-foreground">—</span>
          }
        }}
        onView={r => router.push(`/crm/price-groups/${r.id}`)}
        menuActions={r => [
          { label: 'Edit', icon: <Tag size={12} className="text-app-muted-foreground" />, onClick: () => router.push(`/crm/price-groups/${r.id}/edit`) },
        ]}
        emptyIcon={<Tag size={36} />}
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
