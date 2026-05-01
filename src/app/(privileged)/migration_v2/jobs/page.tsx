'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Jobs = Record<string, any>

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-app-surface-2 text-app-foreground',
  VALIDATING: 'bg-app-warning-bg text-app-warning',
  MAPPING: 'bg-app-info-bg text-app-info',
  READY: 'bg-app-success-bg text-app-success',
  RUNNING: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-app-success-bg text-app-success',
  FAILED: 'bg-app-error-bg text-app-error',
  ROLLED_BACK: 'bg-app-warning-bg text-app-warning',
}

const ALL_COLUMNS: ColumnDef<Jobs>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Job Name', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => {
      const cls = STATUS_COLORS[row.status] || 'bg-app-surface-2 text-app-muted-foreground'
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${cls}`}>
          {row.status}
        </span>
      )
    }
  },
  {
    key: 'imported_products',
    label: 'Products',
    render: (row) => `${row.imported_products || 0} / ${row.total_products || 0}`
  },
  {
    key: 'imported_customers',
    label: 'Contacts',
    render: (row) => `${(row.imported_customers || 0) + (row.imported_suppliers || 0)} / ${row.total_contacts || 0}`
  },
  { key: 'progress_percent', label: 'Progress', render: (row) => `${row.progress_percent || 0}%` },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'
  },
]

export default function JobsListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Jobs[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('migration_v2_jobs', {
    columns: ALL_COLUMNS.map(c => c.key),
    pageSize: 20,
    sortKey: 'id',
    sortDir: 'desc',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('migration_v2/jobs/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<Jobs>
        title="Migration Jobs"
        data={filtered}
        loading={loading}
        getRowId={r => r.id}
        columns={ALL_COLUMNS}
        visibleColumns={settings.visibleColumns}
        onToggleColumn={settings.toggleColumn}
        className="rounded-[32px] border-0 shadow-sm overflow-hidden"
        pageSize={settings.pageSize}
        onPageSizeChange={settings.setPageSize}
        sortKey={settings.sortKey}
        sortDir={settings.sortDir}
        onSort={k => settings.setSort(k)}
        headerExtra={
          <Button
            onClick={() => router.push('/migration_v2')}
            className="h-9 px-4 bg-app-primary text-white hover:bg-app-primary-dark rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={14} className="mr-2" /> New Migration
          </Button>
        }
        actions={{
          onView: (r) => router.push(`/migration_v2/jobs/${r.id}`),
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search jobs...', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
