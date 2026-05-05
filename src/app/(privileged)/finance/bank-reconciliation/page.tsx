'use client'

import { useState, useEffect, useMemo } from "react"
import type { FinancialAccount } from '@/types/erp'
import { getBankAccounts, getBankReconciliation } from "@/app/actions/finance/bank-reconciliation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Landmark, ArrowLeft, Search, DollarSign,
    ArrowUpRight, ArrowDownRight, Hash, FileText, Calendar
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function BankReconciliationPage() {
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [detail, setDetail] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => { loadAccounts() }, [])

    async function loadAccounts() {
        setLoading(true)
        try {
            const data = await getBankAccounts()
            setAccounts(data.accounts || [])
        } catch {
            toast.error("Failed to load bank accounts")
        } finally {
            setLoading(false)
        }
    }

    async function drillIn(accountId: string) {
        setLoading(true)
        setSelectedAccountId(accountId)
        try {
            const data = await getBankReconciliation(accountId, startDate || undefined, endDate || undefined)
            setDetail(data)
        } catch {
            toast.error("Failed to load account entries")
        } finally {
            setLoading(false)
        }
    }

    function goBack() {
        setSelectedAccountId(null)
        setDetail(null)
        setSearch('')
    }

    const filteredEntries = useMemo(() => {
        if (!detail?.entries) return []
        if (!search) return detail.entries
        const s = search.toLowerCase()
        return detail.entries.filter((e: Record<string, any>) =>
            e.reference?.toLowerCase().includes(s) ||
            e.description?.toLowerCase().includes(s)
        )
    }, [detail, search])

    if (loading && !detail && accounts.length === 0) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
            </div>
        )
    }

    // Detail View
    if (selectedAccountId && detail) {
        return (
            <div className="p-6 space-y-6">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={goBack}>
                        <ArrowLeft size={16} className="mr-1" /> Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-app-foreground">
                            {detail.account?.code} — {detail.account?.name}
                        </h1>
                        <p className="text-sm text-app-muted-foreground">Bank reconciliation detail</p>
                    </div>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-emerald-50 to-white border-l-4 border-l-emerald-500">
                        <CardContent className="py-4 text-center">
                            <ArrowDownRight size={20} className="mx-auto mb-1 text-app-success" />
                            <p className="text-xl font-bold text-app-success">{fmt(detail.summary?.total_debit || 0)}</p>
                            <p className="text-[10px] text-app-muted-foreground uppercase">Total Debits</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-white border-l-4 border-l-red-500">
                        <CardContent className="py-4 text-center">
                            <ArrowUpRight size={20} className="mx-auto mb-1 text-app-error" />
                            <p className="text-xl font-bold text-app-error">{fmt(detail.summary?.total_credit || 0)}</p>
                            <p className="text-[10px] text-app-muted-foreground uppercase">Total Credits</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-50 to-white border-l-4 border-l-blue-500">
                        <CardContent className="py-4 text-center">
                            <DollarSign size={20} className="mx-auto mb-1 text-app-info" />
                            <p className="text-xl font-bold text-app-info">{fmt(detail.summary?.book_balance || 0)}</p>
                            <p className="text-[10px] text-app-muted-foreground uppercase">Book Balance</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-gray-50 to-white border-l-4 border-l-gray-500">
                        <CardContent className="py-4 text-center">
                            <Hash size={20} className="mx-auto mb-1 text-app-muted-foreground" />
                            <p className="text-xl font-bold">{detail.summary?.entry_count || 0}</p>
                            <p className="text-[10px] text-app-muted-foreground uppercase">Entries</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Date Filters */}
                <Card>
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={14} className="text-app-muted-foreground" />
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-40" />
                                <span className="text-app-muted-foreground">to</span>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-40" />
                                <Button size="sm" variant="outline" onClick={() => drillIn(selectedAccountId)}>Apply</Button>
                            </div>
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <Input placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Entries Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>Date</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.map((e: Record<string, any>) => (
                                    <TableRow key={e.id} className="hover:bg-app-surface/50">
                                        <TableCell className="text-sm">{e.date || '—'}</TableCell>
                                        <TableCell className="font-mono text-xs text-app-info">{e.reference || '—'}</TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground max-w-xs truncate">{e.description}</TableCell>
                                        <TableCell className="text-right text-sm font-medium text-app-success">
                                            {e.debit > 0 ? fmt(e.debit) : ''}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-medium text-app-error">
                                            {e.credit > 0 ? fmt(e.credit) : ''}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-bold">
                                            {fmt(e.running_balance)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Account List View
    const totalBalance = accounts.reduce((sum, a: any) => sum + (a.book_balance || 0), 0)

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center">
                        <Landmark size={20} className="text-white" />
                    </div>
                    Bank Reconciliation
                </h1>
                <p className="text-sm text-app-muted-foreground mt-1">Review bank & cash accounts, drill into entries</p>
            </header>

            {/* Total Balance */}
            <Card className="bg-app-info text-white">
                <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-200 uppercase font-medium">Total Cash & Bank Balance</p>
                            <p className="text-3xl font-bold mt-1">{fmt(totalBalance)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-blue-200">{accounts.length} accounts</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc: Record<string, any>) => (
                    <Card
                        key={acc.id}
                        className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 border-l-4 border-l-blue-400"
                        onClick={() => drillIn(acc.id)}
                    >
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between mb-3">
                                <Badge variant="outline" className="font-mono text-xs">{acc.code}</Badge>
                                <FileText size={14} className="text-app-faint" />
                            </div>
                            <h3 className="font-semibold text-app-foreground mb-2">{acc.name}</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-bold text-app-info">{fmt(acc.book_balance)}</p>
                                    <p className="text-[10px] text-app-muted-foreground">Book Balance</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-app-muted-foreground">{acc.entry_count} entries</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {accounts.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-app-muted-foreground">
                        <Landmark size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No bank or cash accounts found</p>
                        <p className="text-sm">Set up accounts with type ASSET and sub_type bank/cash</p>
                    </div>
                )}
            </div>
        </div>
    )
}
