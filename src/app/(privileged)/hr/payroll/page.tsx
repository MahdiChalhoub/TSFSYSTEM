'use client'

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Banknote, Users, DollarSign, TrendingUp, Search, Briefcase
} from "lucide-react"

interface PayrollEmployee {
    id: number | string
    first_name?: string
    last_name?: string
    employee_id?: string
    job_title?: string
    employee_type?: string
    salary?: string | number
    [key: string]: unknown
}

interface ListResponse<T> {
    results?: T[]
}

function asArr<T>(d: unknown): T[] {
    if (Array.isArray(d)) return d as T[]
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as ListResponse<T>).results
        return Array.isArray(r) ? r : []
    }
    return []
}

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

function num(v: unknown): number {
    const n = parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? n : 0
}

const TYPE_BADGE: Record<string, string> = {
    EMPLOYEE: 'bg-app-info-bg text-app-info',
    PARTNER: 'bg-purple-100 text-purple-700',
    BOTH: 'bg-app-success-soft text-app-success',
}

export default function PayrollSummaryPage() {
    const [employees, setEmployees] = useState<PayrollEmployee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('hr/employees/')
            setEmployees(asArr<PayrollEmployee>(data))
        } catch {
            toast.error("Failed to load payroll data")
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        let items = employees
        if (typeFilter) items = items.filter(e => e.employee_type === typeFilter)
        if (search) {
            const s = search.toLowerCase()
            items = items.filter(e =>
                `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(s) ||
                (e.job_title || '').toLowerCase().includes(s) ||
                (e.employee_id || '').toLowerCase().includes(s)
            )
        }
        return [...items].sort((a, b) => num(b.salary) - num(a.salary))
    }, [employees, typeFilter, search])

    const totalPayroll = employees.reduce((s, e) => s + num(e.salary), 0)
    const avgSalary = employees.length > 0 ? totalPayroll / employees.length : 0
    const maxSalary = Math.max(...employees.map(e => num(e.salary)), 0)
    const typeCounts: Record<string, number> = {}
    employees.forEach(e => {
        const k = e.employee_type ?? 'UNKNOWN'
        typeCounts[k] = (typeCounts[k] || 0) + 1
    })

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center">
                            <Banknote size={20} className="text-white" />
                        </div>
                        Payroll Summary
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Monthly salary overview and employee compensation</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Monthly Payroll</p>
                                <p className="text-xl font-bold text-app-success">{fmt(totalPayroll)}</p>
                                <p className="text-[10px] text-app-muted-foreground">{fmt(totalPayroll * 12)}/year</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Users size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Headcount</p>
                                <p className="text-2xl font-bold text-app-info">{employees.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Average Salary</p>
                                <p className="text-xl font-bold text-app-warning">{fmt(avgSalary)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Briefcase size={24} className="text-violet-500" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Highest Salary</p>
                                <p className="text-xl font-bold text-violet-700">{fmt(maxSalary)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setTypeFilter(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!typeFilter ? 'bg-app-bg text-white' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-surface-2'
                        }`}
                >
                    All ({employees.length})
                </button>
                {Object.entries(typeCounts).map(([type, count]) => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${typeFilter === type ? 'bg-app-bg text-white' : `${TYPE_BADGE[type]?.split(' ')[0] || 'bg-app-surface-2'} ${TYPE_BADGE[type]?.split(' ')[1] || 'text-app-muted-foreground'}`
                            }`}
                    >
                        {type} ({count})
                    </button>
                ))}
            </div>

            {/* Salary Distribution Bar */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Salary Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {filtered.slice(0, 15).map((e) => {
                            const salary = num(e.salary)
                            const pct = maxSalary > 0 ? (salary / maxSalary * 100) : 0
                            return (
                                <div key={e.id} className="flex items-center gap-3">
                                    <span className="w-32 text-xs font-medium truncate">{e.first_name} {e.last_name}</span>
                                    <div className="flex-1 h-3 bg-app-surface-2 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-app-primary rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="w-24 text-right text-xs font-bold">{fmt(salary)}</span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Payroll Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-app-surface/50">
                                <TableHead>#</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Job Title</TableHead>
                                <TableHead className="text-right">Monthly Salary</TableHead>
                                <TableHead className="text-right">Annual</TableHead>
                                <TableHead className="text-right">% of Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((e, i) => {
                                const salary = num(e.salary)
                                const pct = totalPayroll > 0 ? (salary / totalPayroll * 100) : 0
                                return (
                                    <TableRow key={e.id} className="hover:bg-app-surface/50">
                                        <TableCell className="font-bold text-app-muted-foreground">{i + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-app-success-bg flex items-center justify-center">
                                                    <span className="text-xs font-bold text-app-success">
                                                        {(e.first_name || '?').charAt(0)}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-sm">{e.first_name} {e.last_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-app-muted-foreground">{e.employee_id}</TableCell>
                                        <TableCell>
                                            <Badge className={TYPE_BADGE[e.employee_type ?? ''] || 'bg-app-surface-2'}>
                                                {e.employee_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground">{e.job_title || '—'}</TableCell>
                                        <TableCell className="text-right font-bold text-app-success">{fmt(salary)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(salary * 12)}</TableCell>
                                        <TableCell className="text-right text-sm text-app-muted-foreground">{pct.toFixed(1)}%</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
