'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Rule = Record<string, any>

const BoolBadge = ({ value }: { value: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
    ${value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
    {value ? <Check size={10} /> : <X size={10} />}
    {value ? 'Active' : 'Inactive'}
  </span>
)

const BEHAVIOR_COLORS: Record<string, string> = {
  'ADDED_TO_TTC': 'bg-blue-500/15 text-blue-400',
  'WITHHELD_FROM_AP': 'bg-amber-500/15 text-amber-400',
  'EMBEDDED_IN_PRICE': 'bg-purple-500/15 text-purple-400',
}

const BASE_MODE_LABELS: Record<string, string> = {
  'HT': 'HT (Pre-tax)',
  'TTC': 'TTC (After VAT)',
  'PREVIOUS_TAX': 'Previous Tax',
  'CUSTOM_BASE': 'Custom Base',
}

const ALL_COLUMNS: ColumnDef<Rule>[] = [
  { key: 'name', label: 'Rule Name', sortable: true },
  {
    key: 'rate', label: 'Rate', sortable: true,
    render: (r) => <span className="font-mono text-xs font-semibold">{(parseFloat(r.rate || 0) * 100).toFixed(2)}%</span>
  },
  {
    key: 'transaction_type', label: 'Scope', sortable: true,
    render: (r) => <span className="px-2 py-0.5 rounded bg-app-surface text-[10px] font-semibold uppercase" style={{ color: 'var(--app-foreground)' }}>{r.transaction_type}</span>
  },
  {
    key: 'math_behavior', label: 'Behavior', sortable: true,
    render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${BEHAVIOR_COLORS[r.math_behavior] || 'bg-gray-500/15 text-gray-400'}`}>
        {r.math_behavior?.replace(/_/g, ' ')}
      </span>
    )
  },
  {
    key: 'tax_base_mode', label: 'Base Mode', sortable: true,
    render: (r) => (
      <div className="text-xs">
        <span className="font-semibold" style={{ color: 'var(--app-foreground)' }}>{BASE_MODE_LABELS[r.tax_base_mode] || r.tax_base_mode}</span>
        {r.tax_base_mode === 'PREVIOUS_TAX' && r.base_tax_type && (
          <span className="ml-1 text-[10px]" style={{ color: 'var(--app-muted)' }}>→ {r.base_tax_type}</span>
        )}
      </div>
    )
  },
  {
    key: 'calculation_order', label: 'Order', sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.calculation_order}</span>
  },
  {
    key: 'compound_group', label: 'Group', sortable: true,
    render: (r) => r.compound_group ?
      <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[10px] font-semibold">{r.compound_group}</span> :
      <span style={{ color: 'var(--app-muted)' }}>—</span>
  },
  { key: 'purchase_cost_treatment', label: 'Cost Treatment', sortable: true },
  {
    key: 'is_active', label: 'Status', sortable: true,
    render: (r) => <BoolBadge value={r.is_active} />
  },
]

export default function CustomTaxRulesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('finance_custom-tax-rules', {
    columns: ['name', 'rate', 'math_behavior', 'tax_base_mode', 'calculation_order', 'is_active'],
    pageSize: 20,
    sortKey: 'calculation_order',
    sortDir: 'asc',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('finance/custom-tax-rules/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(r: Rule) {
    if (!confirm(`Delete rule "${r.name}"?`)) return
    try {
      await erpFetch(`finance/custom-tax-rules/${r.id}/`, { method: 'DELETE' })
      toast.success('Rule deleted')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<Rule>
        title="Custom Tax Rules"
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
            onClick={() => router.push('/finance/custom-tax-rules/new')}
            className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={14} className="mr-2" /> New Rule
          </Button>
        }
        actions={{
          onView: (r) => router.push(`/finance/custom-tax-rules/${r.id}`),
          onEdit: (r) => router.push(`/finance/custom-tax-rules/${r.id}`),
          onDelete: handleDelete,
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search rules by name, behavior...', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
