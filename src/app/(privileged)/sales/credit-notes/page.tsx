'use client'

import { useState, useEffect, useMemo } from "react"
import { getCreditNotes } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    CreditCard, FileText, Clock, DollarSign, RefreshCw, User
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'

export default function CreditNotesPage() {
    const { fmt } = useCurrency()
    const [creditNotes, setCreditNotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const settings = useListViewSettings('sales_credit_notes', {
        columns: ['credit_number', 'date', 'customer', 'amount', 'status'],
        pageSize: 25, sortKey: 'date', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const cn = await getCreditNotes()
            setCreditNotes(Array.isArray(cn) ? cn : [])
        } catch {
            toast.error("Failed to load credit notes")
        } finally {
            setLoading(false)
        }
    }

    const stats = useMemo(() => {
        const totalAmount = creditNotes.reduce((s, cn) => s + Number(cn.amount || 0), 0)
        return { total: creditNotes.length, totalAmount }
    }, [creditNotes])

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'credit_number',
            label: 'Credit Note #',
            sortable: true,
            render: (cn) => <span className="font-mono text-sm font-black text-gray-900">{cn.credit_number || `CN-${cn.id}`}</span>
        },
        {
            key: 'date',
            label: 'Issue Date',
            sortable: true,
            render: (cn) => <span className="text-sm text-gray-600 font-medium">{cn.date || cn.created_at?.split('T')[0] || '—'}</span>
        },
        {
            key: 'customer',
            label: 'Customer',
            sortable: true,
            render: (cn) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center">
                        <User size={12} className="text-stone-400" />
                    </div>
                    <span className="font-bold text-gray-900 text-sm">{cn.customer_name || 'Anonymous'}</span>
                </div>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right' as const,
            sortable: true,
            render: (cn) => <span className="font-mono text-sm font-black text-indigo-600">{fmt(Number(cn.amount || 0))}</span>
        },
        {
            key: 'status',
            label: 'Status',
            align: 'center' as const,
            render: (cn) => (
                <Badge variant="outline" className="gap-1 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 font-semibold text-[10px] uppercase h-5">
                    <FileText size={10} /> {cn.status || 'ISSUED'}
                </Badge>
            )
        },
    ], [fmt])

    if (loading && creditNotes.length === 0) {
        return (
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <CreditCard size={28} className="text-white" />
                        </div>
                        Credit <span className="text-indigo-600">Notes</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
                        Post-Return Credit Ledger
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="h-12 w-12 rounded-2xl border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CreditCard size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Notes</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-gray-900">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Value</p>
                            <p className="text-xl font-black mt-1 tracking-tight text-emerald-600 truncate">{fmt(stats.totalAmount)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">This Month</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-gray-900">
                                {creditNotes.filter(cn => {
                                    const d = cn.date || cn.created_at
                                    if (!d) return false
                                    const now = new Date()
                                    const noteDate = new Date(d)
                                    return noteDate.getMonth() === now.getMonth() && noteDate.getFullYear() === now.getFullYear()
                                }).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView
                title="Credit Note Register"
                data={creditNotes}
                loading={loading}
                getRowId={(item) => item.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
            />
        </div>
    )
}
