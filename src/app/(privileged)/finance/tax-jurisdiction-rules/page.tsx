'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { erpFetch } from '@/lib/erp-api'
import { Plus, Check, X, Globe, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type JurisdictionRule = Record<string, any>

const BoolBadge = ({ value, yesLabel, noLabel }: { value: boolean; yesLabel?: string; noLabel?: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
    ${value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
        {value ? <Check size={10} /> : <X size={10} />}
        {value ? (yesLabel || 'Yes') : (noLabel || 'No')}
    </span>
)

const SUPPLY_MODE_COLORS: Record<string, string> = {
    ORIGIN: 'bg-blue-500/15 text-blue-400',
    DESTINATION: 'bg-teal-500/15 text-teal-400',
    REVERSE_CHARGE: 'bg-amber-500/15 text-amber-400',
}

const TAX_TYPE_COLORS: Record<string, string> = {
    VAT: 'bg-indigo-500/15 text-indigo-400',
    SALES_TAX: 'bg-cyan-500/15 text-cyan-400',
    GST: 'bg-violet-500/15 text-violet-400',
    EXCISE: 'bg-orange-500/15 text-orange-400',
    WITHHOLDING: 'bg-rose-500/15 text-rose-400',
    OTHER: 'bg-gray-500/15 text-gray-400',
}

const ALL_COLUMNS: ColumnDef<JurisdictionRule>[] = [
    {
        key: 'name', label: 'Rule Name', sortable: true,
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
                <span className="font-mono text-xs font-semibold">{r.country_code}</span>
                {r.region_code && (
                    <>
                        <MapPin size={10} style={{ color: 'var(--app-muted)' }} />
                        <span className="font-mono text-[10px]" style={{ color: 'var(--app-muted)' }}>{r.region_code}</span>
                    </>
                )}
            </div>
        )
    },
    {
        key: 'tax_type', label: 'Tax Type', sortable: true,
        render: (r) => (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${TAX_TYPE_COLORS[r.tax_type] || TAX_TYPE_COLORS.OTHER}`}>
                {r.tax_type}
            </span>
        )
    },
    {
        key: 'rate', label: 'Rate', sortable: true,
        render: (r) => <span className="font-mono text-xs font-semibold">{(parseFloat(r.rate || 0) * 100).toFixed(2)}%</span>
    },
    {
        key: 'place_of_supply_mode', label: 'Supply Mode', sortable: true,
        render: (r) => (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${SUPPLY_MODE_COLORS[r.place_of_supply_mode] || ''}`}>
                {r.place_of_supply_mode}
            </span>
        )
    },
    {
        key: 'reverse_charge_allowed', label: 'RC', sortable: true,
        render: (r) => <BoolBadge value={r.reverse_charge_allowed} yesLabel="RC" noLabel="—" />
    },
    {
        key: 'zero_rate_export', label: 'Zero Export', sortable: true,
        render: (r) => <BoolBadge value={r.zero_rate_export} yesLabel="0%" noLabel="No" />
    },
    {
        key: 'priority', label: 'Priority', sortable: true,
        render: (r) => <span className="font-mono text-xs">{r.priority}</span>
    },
    {
        key: 'effective_from', label: 'Effective', sortable: true,
        render: (r) => (
            <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>
                {r.effective_from || '∞'} → {r.effective_to || '∞'}
            </span>
        )
    },
    {
        key: 'is_active', label: 'Status', sortable: true,
        render: (r) => <BoolBadge value={r.is_active} yesLabel="Active" noLabel="Off" />
    },
]

export default function TaxJurisdictionRulesListPage() {
    const router = useRouter()
    const [items, setItems] = useState<JurisdictionRule[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const settings = useListViewSettings('finance_tax-jurisdiction-rules', {
        columns: ['name', 'country_code', 'tax_type', 'rate', 'place_of_supply_mode', 'reverse_charge_allowed', 'zero_rate_export', 'priority', 'is_active'],
        pageSize: 20,
        sortKey: 'priority',
        sortDir: 'desc',
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            setLoading(true)
            const data = await erpFetch('finance/tax-jurisdiction-rules/')
            setItems(Array.isArray(data) ? data : (data?.results || []))
        } catch (error) {
            console.error('Failed to load:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(r: JurisdictionRule) {
        if (r.is_system_preset) { toast.error('Cannot delete system presets'); return }
        if (!confirm(`Delete rule "${r.name}"?`)) return
        try {
            await erpFetch(`finance/tax-jurisdiction-rules/${r.id}/`, { method: 'DELETE' })
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
            <TypicalListView<JurisdictionRule>
                title="Tax Jurisdiction Rules"
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
                        onClick={() => router.push('/finance/tax-jurisdiction-rules/new')}
                        className="h-9 px-4 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
                    >
                        <Plus size={14} className="mr-2" /> New Rule
                    </Button>
                }
                actions={{
                    onView: (r) => router.push(`/finance/tax-jurisdiction-rules/${r.id}`),
                    onEdit: (r) => router.push(`/finance/tax-jurisdiction-rules/${r.id}`),
                    onDelete: handleDelete,
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search by name, country, tax type...', value: search, onChange: setSearch }}
                />
            </TypicalListView>
        </div>
    )
}
