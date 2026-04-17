'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Zap } from 'lucide-react'

type AutoRules = Record<string, any>

const ALL_COLUMNS: ColumnDef<AutoRules>[] = [
  { key: 'id', label: 'ID', sortable: true },
]

export default function AutoRulesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<AutoRules[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('workspace_auto-rules', {
    columns: ALL_COLUMNS.map(c => c.key),
    pageSize: 20,
    sortKey: 'id',
    sortDir: 'asc',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('workspace/auto-rules/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load auto-rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0 mb-3">
        <div className="page-header-icon bg-app-primary"
             style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Auto Rules</h1>
          <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
            {items.length} Records · Raw auto-rule list
          </p>
        </div>
        <button
          onClick={() => router.push('/workspace/auto-rules/new')}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Create</span>
        </button>
      </div>

      <TypicalListView<AutoRules>
        title="Auto Rules"
        data={filtered}
        loading={loading}
        getRowId={r => r.id}
        columns={ALL_COLUMNS}
        visibleColumns={settings.visibleColumns}
        onToggleColumn={settings.toggleColumn}
        pageSize={settings.pageSize}
        onPageSizeChange={settings.setPageSize}
        sortKey={settings.sortKey}
        sortDir={settings.sortDir}
        onSort={k => settings.setSort(k)}
        actions={{
          onView: (r) => router.push(`/workspace/auto-rules/${r.id}`),
          onEdit: (r) => router.push(`/workspace/auto-rules/${r.id}/edit`),
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search… (Ctrl+K)', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
