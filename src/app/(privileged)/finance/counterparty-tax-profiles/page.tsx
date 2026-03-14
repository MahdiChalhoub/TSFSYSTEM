'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Check, X, Shield, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Profile = Record<string, any>

const BoolBadge = ({ value, yesLabel, noLabel }: { value: boolean; yesLabel?: string; noLabel?: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
    ${value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
    {value ? <Check size={10} /> : <X size={10} />}
    {value ? (yesLabel || 'Yes') : (noLabel || 'No')}
  </span>
)

const ALL_COLUMNS: ColumnDef<Profile>[] = [
  {
    key: 'name', label: 'Profile Name', sortable: true,
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium" style={{ color: 'var(--app-foreground)' }}>{r.name}</span>
        {r.is_system_preset && (
          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[9px] font-bold uppercase">Preset</span>
        )}
      </div>
    )
  },
  {
    key: 'country_code', label: 'Country', sortable: true,
    render: (r) => (
      <div className="flex items-center gap-1">
        <Globe size={12} style={{ color: 'var(--app-muted)' }} />
        <span className="font-mono text-xs">{r.country_code}</span>
        {r.state_code && <span className="font-mono text-xs" style={{ color: 'var(--app-muted)' }}>-{r.state_code}</span>}
      </div>
    )
  },
  {
    key: 'vat_registered', label: 'VAT Registered', sortable: true,
    render: (r) => <BoolBadge value={r.vat_registered} />
  },
  {
    key: 'reverse_charge', label: 'Reverse Charge', sortable: true,
    render: (r) => <BoolBadge value={r.reverse_charge} yesLabel="RC" noLabel="—" />
  },
  {
    key: 'airsi_subject', label: 'Withholding', sortable: true,
    render: (r) => <BoolBadge value={r.airsi_subject} yesLabel="WHT" noLabel="—" />
  },
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
  {
    key: 'enforce_compliance', label: 'Compliance', sortable: true,
    render: (r) => r.enforce_compliance ?
      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold uppercase">Enforced</span> :
      <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>—</span>
  },
]

export default function CounterpartyTaxProfilesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('finance_counterparty-tax-profiles', {
    columns: ['name', 'country_code', 'vat_registered', 'reverse_charge', 'airsi_subject', 'allowed_scopes'],
    pageSize: 20,
    sortKey: 'name',
    sortDir: 'asc',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch('finance/counterparty-tax-profiles/')
      setItems(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item =>
    search ? JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <TypicalListView<Profile>
        title="Counterparty Tax Profiles"
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
            onClick={() => router.push('/finance/counterparty-tax-profiles/new')}
            className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            <Plus size={14} className="mr-2" /> New Profile
          </Button>
        }
        actions={{
          onView: (r) => router.push(`/finance/counterparty-tax-profiles/${r.id}`),
          onEdit: (r) => router.push(`/finance/counterparty-tax-profiles/${r.id}`),
        }}
      >
        <TypicalFilter
          search={{ placeholder: 'Search profiles by name, country...', value: search, onChange: setSearch }}
        />
      </TypicalListView>
    </div>
  )
}
