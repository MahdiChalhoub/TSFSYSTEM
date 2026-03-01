'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Employee } from '@/types/erp';
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { Banknote, Users, DollarSign, TrendingUp, Search, Briefcase, ChevronRight, BarChart3, Wallet, Landmark, ArrowRight } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type PayrollRecord = Record<string, any>;

const TYPE_BADGE: Record<string, string> = {
    EMPLOYEE: 'bg-blue-100 text-blue-700',
    PARTNER: 'bg-purple-100 text-purple-700',
    BOTH: 'bg-teal-100 text-teal-700',
};

const ALL_COLUMNS: ColumnDef<PayrollRecord>[] = [
    { key: 'identity', label: 'Human Entity', sortable: true, alwaysVisible: true },
    { key: 'id', label: 'Record ID', sortable: true },
    { key: 'classification', label: 'Category' },
    { key: 'role', label: 'Functional Designation' },
    { key: 'salary', label: 'Monthly Exposure', align: 'right', sortable: true },
    { key: 'annual', label: 'Annual Commitment', align: 'right' },
    { key: 'pct', label: 'Cost Concentration', align: 'right' },
];

export default function CompensationEnginePage() {
    const { fmt } = useCurrency();
    const settings = useListViewSettings('hr_payroll_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 25,
        sortKey: 'salary',
        sortDir: 'desc',
    });

    const [employees, setEmployees] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    useEffect(() => { loadData() }, []);

    async function loadData() {
        setLoading(true);
        try {
            const { erpFetch } = await import("@/lib/erp-api");
            const data = await erpFetch('hr/employees/');
            setEmployees(Array.isArray(data) ? data : data.results || []);
        } catch {
            toast.error("Compensation engine sync failed");
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        let items = employees;
        if (typeFilter !== 'ALL') items = items.filter(e => e.employee_type === typeFilter);
        if (search) {
            const s = search.toLowerCase();
            items = items.filter(e =>
                `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(s) ||
                (e.job_title || '').toLowerCase().includes(s) ||
                (e.employee_id || '').toLowerCase().includes(s)
            );
        }
        return items;
    }, [employees, typeFilter, search]);

    const totalPayroll = employees.reduce((s, e) => s + parseFloat(e.salary || 0), 0);
    const avgSalary = employees.length > 0 ? totalPayroll / employees.length : 0;
    const maxSalary = Math.max(...employees.map(e => parseFloat(e.salary || 0)), 0);

    const columns: ColumnDef<PayrollRecord>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: PayrollRecord) => React.ReactNode> = {
            identity: r => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">
                        {(r.first_name || '?').charAt(0)}
                    </div>
                    <span className="font-bold text-gray-900 uppercase tracking-tight">{r.first_name} {r.last_name}</span>
                </div>
            ),
            id: r => <span className="font-mono text-[10px] text-gray-400 font-black tracking-widest">{r.employee_id}</span>,
            classification: r => (
                <Badge className={`${TYPE_BADGE[r.employee_type] || 'bg-gray-100'} border-0 text-[9px] font-black uppercase`}>
                    {r.employee_type}
                </Badge>
            ),
            role: r => <span className="text-xs font-bold text-stone-500">{r.job_title || '—'}</span>,
            salary: r => <span className="font-black text-emerald-600">{fmt(parseFloat(r.salary || 0))}</span>,
            annual: r => <span className="text-xs text-gray-400 font-medium">{fmt(parseFloat(r.salary || 0) * 12)}</span>,
            pct: r => {
                const s = parseFloat(r.salary || 0);
                const p = totalPayroll > 0 ? (s / totalPayroll * 100) : 0;
                return <span className="text-[10px] font-black text-gray-400">{p.toFixed(1)}%</span>;
            }
        };
        return { ...c, render: renderers[c.key] };
    });

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Banknote size={28} className="text-white" />
                        </div>
                        Compensation <span className="text-emerald-600">Engine</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Payroll & Economic Exposure</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Pricing Engine Active</span>
                </div>
            </header>

            {/* Economic Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Wallet size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Monthly Exposure</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(totalPayroll)}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Active Headcount</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{employees.length}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Avg Compensation</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(avgSalary)}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Landmark size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Max Liability</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(maxSalary)}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <TypicalListView<PayrollRecord>
                        title="Payroll Ledger"
                        data={filtered}
                        loading={loading}
                        getRowId={r => r.id}
                        columns={columns}
                        visibleColumns={settings.visibleColumns}
                        onToggleColumn={settings.toggleColumn}
                        className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden"
                        pageSize={settings.pageSize}
                        onPageSizeChange={settings.setPageSize}
                        sortKey={settings.sortKey}
                        sortDir={settings.sortDir}
                        onSort={k => settings.setSort(k)}
                        actions={{
                            onEdit: (r) => toast.info(`Accessing financial stream for ${r.first_name}`),
                        }}
                    >
                        <TypicalFilter
                            search={{ placeholder: 'Search employees...', value: search, onChange: setSearch }}
                            filters={[
                                {
                                    key: 'type', label: 'Entity Category', type: 'select', options: [
                                        { value: 'ALL', label: 'Global (All)' },
                                        { value: 'EMPLOYEE', label: 'Internal Staff' },
                                        { value: 'PARTNER', label: 'External Partners' },
                                        { value: 'BOTH', label: 'Hybrid Entities' },
                                    ]
                                }
                            ]}
                            values={{ type: typeFilter }}
                            onChange={(k, v) => setTypeFilter(String(v))}
                        />
                    </TypicalListView>
                </div>

                <div className="space-y-6">
                    <Card className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden">
                        <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Resource Concentration</CardTitle>
                            <BarChart3 size={14} className="text-stone-300" />
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                {filtered.slice(0, 10).map((e: PayrollRecord) => {
                                    const salary = parseFloat(e.salary || 0);
                                    const pct = maxSalary > 0 ? (salary / maxSalary * 100) : 0;
                                    return (
                                        <div key={e.id} className="space-y-2 group">
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-tight truncate max-w-[120px]">{e.first_name} {e.last_name}</span>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-stone-400">{fmt(salary)}</span>
                                            </div>
                                            <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-1000 group-hover:bg-emerald-400"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {filtered.length > 10 && (
                                    <div className="pt-4 border-t border-stone-50 text-center">
                                        <p className="text-[9px] font-black text-stone-300 uppercase tracking-widest">Showing top concentration nodes</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-0 shadow-sm bg-gray-900 text-white p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                            <TrendingUp size={120} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black tracking-tighter mb-2">Liability Pulse</h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                Total annual operational liability currently calculated at
                            </p>
                            <div className="text-4xl font-black text-emerald-400 mt-4 tracking-tighter">
                                {fmt(totalPayroll * 12)}
                            </div>
                            <Button className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black uppercase text-[10px] tracking-widest border border-white/10 group">
                                Generate Audit Manifest <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
