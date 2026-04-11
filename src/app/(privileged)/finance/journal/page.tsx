'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Journal = Record<string, any>

const ALL_COLUMNS: ColumnDef<Journal>[] = [
  { key: 'id', label: 'ID', sortable: true }
]

export default function JournalListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('finance_journal', {
    columns: ALL_COLUMNS.map(c => c.key),
    pageSize: 20,
    sortKey: 'id',
    sortDir: 'asc',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('finance/journal/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load journal:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<Journal>
        title="Journal"
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
            onClick={() => router.push('/finance/journal/new')}
            className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={14} className="mr-2" /> Create New
          </Button>
        }
        actions={{
          onView: (r) => router.push(`/finance/journal/${r.id}`),
          onEdit: (r) => router.push(`/finance/journal/${r.id}/edit`),
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search...', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
