'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Shield, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type OrgTaxPolicy = Record<string, any>

const BoolBadge = ({ value }: { value: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
    ${value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
    {value ? <Check size={10} /> : <X size={10} />}
    {value ? 'Yes' : 'No'}
  </span>
)

const ALL_COLUMNS: ColumnDef<OrgTaxPolicy>[] = [
  { key: 'name', label: 'Policy Name', sortable: true },
  {
    key: 'is_default', label: 'Default', sortable: true,
    render: (r) => <BoolBadge value={r.is_default} />
  },
  {
    key: 'country_code', label: 'Country', sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.country_code}</span>
  },
  {
    key: 'currency_code', label: 'Currency', sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.currency_code}</span>
  },
  {
    key: 'vat_output_enabled', label: 'VAT Output', sortable: true,
    render: (r) => <BoolBadge value={r.vat_output_enabled} />
  },
  {
    key: 'vat_input_recoverability', label: 'VAT Recovery', sortable: true,
    render: (r) => <span className="font-mono text-xs">{(parseFloat(r.vat_input_recoverability || 0) * 100).toFixed(1)}%</span>
  },
  {
    key: 'airsi_treatment', label: 'Withholding Treatment', sortable: true,
    render: (r) => (
      <span className="px-2 py-0.5 rounded-full bg-app-surface text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>
        {r.airsi_treatment || '—'}
      </span>
    )
  },
  {
    key: 'purchase_tax_rate', label: 'Purchase Tax', sortable: true,
    render: (r) => <span className="font-mono text-xs">{(parseFloat(r.purchase_tax_rate || 0) * 100).toFixed(2)}%</span>
  },
  { key: 'internal_cost_mode', label: 'Cost Mode', sortable: true },
  {
    key: 'allowed_scopes', label: 'Scopes', sortable: false,
    render: (r) => (
      <div className="flex gap-1">
        {(r.allowed_scopes || []).map((s: string) => (
          <span key={s} className="px-1.5 py-0.5 rounded bg-app-accent/20 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-accent)' }}>{s}</span>
        ))}
      </div>
    )
  },
]

export default function OrgTaxPoliciesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<OrgTaxPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('finance_org-tax-policies', {
    columns: ['name', 'is_default', 'country_code', 'vat_output_enabled', 'vat_input_recoverability', 'airsi_treatment', 'internal_cost_mode'],
    pageSize: 20,
    sortKey: 'name',
    sortDir: 'asc',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('finance/org-tax-policies/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load org-tax-policies:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<OrgTaxPolicy>
        title="Organization Tax Policies"
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
            onClick={() => router.push('/finance/org-tax-policies/new')}
            className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={14} className="mr-2" /> New Policy
          </Button>
        }
        actions={{
          onView: (r) => router.push(`/finance/org-tax-policies/${r.id}`),
          onEdit: (r) => router.push(`/finance/org-tax-policies/${r.id}`),
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search policies by name, country, treatment...', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
