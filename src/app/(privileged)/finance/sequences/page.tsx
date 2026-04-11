// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Hash, Search } from 'lucide-react'

type Sequences = Record<string, any>

const ALL_COLUMNS: ColumnDef<Sequences>[] = [
 { key: 'id', label: 'ID', sortable: true },
 { key: 'prefix', label: 'Prefix', sortable: true, render: (r) => <span className="font-mono font-bold text-app-primary">{r.prefix || '—'}</span> },
 { key: 'name', label: 'Name', sortable: true, render: (r) => <span className="font-bold text-app-foreground">{r.name || r.sequence_type || '—'}</span> },
 { key: 'next_number', label: 'Next #', sortable: true, render: (r) => <span className="font-mono text-app-muted-foreground">{r.next_number ?? r.current_value ?? '—'}</span> },
 { key: 'padding', label: 'Padding', render: (r) => <span className="text-app-muted-foreground">{r.padding || r.zero_padding || '—'}</span> },
]

export default function SequencesListPage() {
 const router = useRouter()
 const [items, setItems] = useState<Sequences[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')

 const settings = useListViewSettings('finance_sequences', {
  columns: ALL_COLUMNS.map(c => c.key),
  pageSize: 20,
  sortKey: 'id',
  sortDir: 'asc',
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
  try {
   setLoading(true)
   const data = await erpFetch('finance/sequences/')
   setItems(Array.isArray(data) ? data : (data?.results || []))
  } catch (error) {
   console.error('Failed to load sequences:', error)
  } finally {
   setLoading(false)
  }
 }

 const filtered = items.filter(item =>
  search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
 )

 return (
  <div className="app-page space-y-6">
   {/* ── V2 Icon-Box Header ── */}
   <header className="flex items-center justify-between">
    <div className="flex items-center gap-4">
     <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center shrink-0"
      style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
      <Hash size={26} style={{ color: 'var(--app-primary)' }} />
     </div>
     <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
      <h1 className="text-2xl font-black tracking-tight text-app-foreground">
       Document <span className="text-app-primary">Sequences</span>
      </h1>
     </div>
    </div>
    <button
     onClick={() => router.push('/finance/sequences/new')}
     className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
     style={{ background: 'var(--app-primary)' }}
    >
     <Plus size={14} /> New Sequence
    </button>
   </header>

   {/* ── KPI Strip ── */}
   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div className="rounded-2xl p-4 border border-app-border/50"
     style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
     <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total</p>
     <p className="text-2xl font-black text-app-foreground mt-1">{items.length}</p>
    </div>
    <div className="rounded-2xl p-4 border border-app-border/50"
     style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)' }}>
     <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active</p>
     <p className="text-2xl font-black text-app-primary mt-1">{items.filter(i => i.is_active !== false).length}</p>
    </div>
   </div>

   {/* ── List ── */}
   <TypicalListView<Sequences>
    title="Sequences"
    data={filtered}
    loading={loading}
    getRowId={r => r.id}
    columns={ALL_COLUMNS}
    visibleColumns={settings.visibleColumns}
    onToggleColumn={settings.toggleColumn}
    className="rounded-2xl border border-app-border/50 shadow-sm overflow-hidden"
    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}
    pageSize={settings.pageSize}
    onPageSizeChange={settings.setPageSize}
    sortKey={settings.sortKey}
    sortDir={settings.sortDir}
    onSort={k => settings.setSort(k)}
    headerExtra={
     <div className="relative w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
      <input
       placeholder="Search sequences..."
       value={search}
       onChange={e => setSearch(e.target.value)}
       className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-app-border/50 bg-app-surface text-app-foreground focus:outline-none focus:ring-1 focus:ring-app-primary/30"
      />
     </div>
    }
    actions={{
     onView: (r) => router.push(`/finance/sequences/${r.id}`),
     onEdit: (r) => router.push(`/finance/sequences/${r.id}/edit`),
    }}
   />
  </div>
 )
}
