'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { ArrowLeft, Search, Filter } from 'lucide-react'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type MappingRecord = Record<string, any>

const ALL_COLUMNS: ColumnDef<MappingRecord>[] = [
    {
        key: 'entity_type',
        label: 'Type',
        sortable: true,
        render: (r) => (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-app-surface-2 text-app-foreground">
                {r.entity_type}
            </span>
        )
    },
    {
        key: 'source_id',
        label: 'Source ID',
        sortable: true,
        render: (r) => (
            <span className="font-mono text-xs text-app-text-faint">{r.source_id}</span>
        )
    },
    {
        key: 'target_id',
        label: 'Target TSFSYSTEM ID',
        sortable: true,
        render: (r) => (
            <span className="font-mono text-xs font-bold text-app-success">{r.target_id || 'Failed/Pending'}</span>
        )
    },
    {
        key: 'verify_status',
        label: 'Status',
        sortable: true,
        render: (r) => (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.verify_status === 'VERIFIED' ? 'bg-app-success-bg text-app-success' :
                r.verify_status === 'FLAGGED' ? 'bg-app-warning-bg text-app-warning' :
                    'bg-app-surface theme-text-muted'
                }`}>
                {r.verify_status || 'UNVERIFIED'}
            </span>
        )
    },
    {
        key: 'source_data',
        label: 'Original Source Data',
        sortable: false,
        render: (r) => (
            <div className="max-w-[400px] overflow-auto hover:max-h-none transition-all">
                <pre className="text-[9px] font-mono text-app-text-faint whitespace-pre-wrap leading-tight">
                    {JSON.stringify(r.source_data, null, 2)}
                </pre>
            </div>
        )
    }
]

export default function MigrationMappingsPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    const [items, setItems] = useState<MappingRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [entityFilter, setEntityFilter] = useState<string>('ALL')

    const settings = useListViewSettings('migration_v2_mappings', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 50,
        sortKey: 'entity_type',
        sortDir: 'asc',
    })

    useEffect(() => {
        loadData()
    }, [id])

    async function loadData() {
        try {
            setLoading(true)
            // Call the correct detail action endpoint on the jobs ViewSet
            const data = await erpFetch(`migration_v2/jobs/${id}/mappings/?limit=1000`)
            setItems(Array.isArray(data) ? data : (data?.results || []))
        } catch (error) {
            console.error('Failed to load mappings:', error)
        } finally {
            setLoading(false)
        }
    }

    const filtered = items.filter(item => {
        if (entityFilter !== 'ALL' && item.entity_type !== entityFilter) return false;
        if (search) {
            return JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
        }
        return true;
    })

    const entityTypes = Array.from(new Set(items.map(i => i.entity_type))).sort()

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-app-surface p-6">
            <div className="max-w-[1400px] mx-auto space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-app-surface-2 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-app-text" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-app-text uppercase tracking-tight">Audit Trail & Mappings</h1>
                        <p className="text-app-text-faint text-sm">Review precise entity linkages between the source dump and TSFSYSTEM.</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-faint" />
                        <Input
                            placeholder="Search in source data or IDs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 border-app-border bg-app-surface"
                        />
                    </div>
                    <div className="w-[250px]">
                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="h-10 border-app-border bg-app-surface">
                                <SelectValue placeholder="Filter Entity Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Entities</SelectItem>
                                {entityTypes.map(t => (
                                    <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <TypicalListView<MappingRecord>
                    title={`Raw Mappings (${filtered.length})`}
                    data={filtered}
                    loading={loading}
                    getRowId={r => r.id}
                    columns={ALL_COLUMNS}
                    visibleColumns={settings.visibleColumns}
                    onToggleColumn={settings.toggleColumn}
                    className="rounded-[32px] border border-app-border bg-app-surface shadow-xl overflow-hidden"
                    pageSize={settings.pageSize}
                    onPageSizeChange={settings.setPageSize}
                    sortKey={settings.sortKey}
                    sortDir={settings.sortDir}
                    onSort={k => settings.setSort(k)}
                />
            </div>
        </div>
    )
}
