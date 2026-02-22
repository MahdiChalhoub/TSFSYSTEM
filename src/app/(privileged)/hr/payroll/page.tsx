'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect, useMemo } from "react"
import type { Employee } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Banknote, Users, DollarSign, TrendingUp, Search, Briefcase
} from "lucide-react"

const TYPE_BADGE: Record<string, string> = {
    EMPLOYEE: 'bg-blue-100 text-blue-700',
    PARTNER: 'bg-purple-100 text-purple-700',
    BOTH: 'bg-teal-100 text-teal-700',
}

export default function PayrollSummaryPage() {
    const { fmt } = useCurrency()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('hr/employees/')
            setEmployees(Array.isArray(data) ? data : data.results || [])
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
        return items.sort((a: Record<string, any>, b: Record<string, any>) => parseFloat(b.salary || 0) - parseFloat(a.salary || 0))
    }, [employees, typeFilter, search])

    const totalPayroll = employees.reduce((s, e) => s + parseFloat(e.salary || 0), 0)
    const avgSalary = employees.length > 0 ? totalPayroll / employees.length : 0
    const maxSalary = Math.max(...employees.map(e => parseFloat(e.salary || 0)), 0)
    const typeCounts: Record<string, number> = {}
    employees.forEach(e => { typeCounts[e.employee_type] = (typeCounts[e.employee_type] || 0) + 1 })

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
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Banknote size={28} className="text-white" />
                        </div>
                        Payroll <span className="text-emerald-600">Management</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Salaries & Compensation</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-emerald-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Monthly Payroll</p>
                                <p className="text-xl font-bold text-emerald-700">{fmt(totalPayroll)}</p>
                                <p className="text-[10px] text-gray-400">{fmt(totalPayroll * 12)}/year</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Users size={24} className="text-blue-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Headcount</p>
                                <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-amber-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Average Salary</p>
                                <p className="text-xl font-bold text-amber-700">{fmt(avgSalary)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Briefcase size={24} className="text-violet-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Highest Salary</p>
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
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!typeFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    All ({employees.length})
                </button>
                {Object.entries(typeCounts).map(([type, count]) => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${typeFilter === type ? 'bg-gray-900 text-white' : `${TYPE_BADGE[type]?.split(' ')[0] || 'bg-gray-100'} ${TYPE_BADGE[type]?.split(' ')[1] || 'text-gray-600'}`
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
                        {filtered.slice(0, 15).map((e: Record<string, any>) => {
                            const salary = parseFloat(e.salary || 0)
                            const pct = maxSalary > 0 ? (salary / maxSalary * 100) : 0
                            return (
                                <div key={e.id} className="flex items-center gap-3">
                                    <span className="w-32 text-xs font-medium truncate">{e.first_name} {e.last_name}</span>
                                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-400 rounded-full transition-all"
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
                            <TableRow className="bg-gray-50/50">
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
                            {filtered.map((e: Record<string, any>, i: number) => {
                                const salary = parseFloat(e.salary || 0)
                                const pct = totalPayroll > 0 ? (salary / totalPayroll * 100) : 0
                                return (
                                    <TableRow key={e.id} className="hover:bg-gray-50/50">
                                        <TableCell className="font-bold text-gray-400">{i + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-emerald-600">
                                                        {(e.first_name || '?').charAt(0)}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-sm">{e.first_name} {e.last_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-gray-400">{e.employee_id}</TableCell>
                                        <TableCell>
                                            <Badge className={TYPE_BADGE[e.employee_type] || 'bg-gray-100'}>
                                                {e.employee_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">{e.job_title || '—'}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">{fmt(salary)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(salary * 12)}</TableCell>
                                        <TableCell className="text-right text-sm text-gray-500">{pct.toFixed(1)}%</TableCell>
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
