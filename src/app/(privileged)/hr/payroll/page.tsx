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
 EMPLOYEE: 'bg-app-info-bg text-app-info',
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
 toast.error("Failed to load payroll data");
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
 <div className="app-page flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-primary-light text-app-primary flex items-center justify-center font-black text-xs">
 {(r.first_name || '?').charAt(0)}
 </div>
 <span className="font-bold text-app-foreground uppercase tracking-tight">{r.first_name} {r.last_name}</span>
 </div>
 ),
 id: r => <span className="font-mono text-[10px] text-app-muted-foreground font-black tracking-widest">{r.employee_id}</span>,
 classification: r => (
 <Badge className={`${TYPE_BADGE[r.employee_type] || 'bg-app-surface-2'} border-0 text-[9px] font-black uppercase`}>
 {r.employee_type}
 </Badge>
 ),
 role: r => <span className="text-xs font-bold text-app-muted-foreground">{r.job_title || '—'}</span>,
 salary: r => <span className="font-black text-app-primary">{fmt(parseFloat(r.salary || 0))}</span>,
 annual: r => <span className="text-xs text-app-muted-foreground font-medium">{fmt(parseFloat(r.salary || 0) * 12)}</span>,
 pct: r => {
 const s = parseFloat(r.salary || 0);
 const p = totalPayroll > 0 ? (s / totalPayroll * 100) : 0;
 return <span className="text-[10px] font-black text-app-muted-foreground">{p.toFixed(1)}%</span>;
 }
 };
 return { ...c, render: renderers[c.key] };
 });

 return (
 <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Banknote size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Human Resources</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Payroll <span className="text-app-primary">Center</span>
          </h1>
        </div>
      </div>
    </header>

 {/* Economic Intelligence */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <Wallet size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider text-left">Monthly Exposure</p>
 <h2 className="text-3xl font-black text-app-foreground mt-0.5">{fmt(totalPayroll)}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <Users size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider text-left">Active Headcount</p>
 <h2 className="text-3xl font-black text-app-foreground mt-0.5">{employees.length}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-app-warning-bg text-app-warning flex items-center justify-center group-hover:scale-110 transition-transform">
 <TrendingUp size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider text-left">Avg Compensation</p>
 <h2 className="text-3xl font-black text-app-foreground mt-0.5">{fmt(avgSalary)}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-violet-50 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <Landmark size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider text-left">Max Liability</p>
 <h2 className="text-3xl font-black text-app-foreground mt-0.5">{fmt(maxSalary)}</h2>
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
 key: 'type', label: 'Type', type: 'select', options: [
 { value: 'ALL', label: 'All' },
 { value: 'EMPLOYEE', label: 'Employees' },
 { value: 'PARTNER', label: 'Partners' },
 { value: 'BOTH', label: 'Both' },
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
 <CardHeader className="bg-app-surface/50 border-b border-app-border p-6 flex flex-row items-center justify-between">
 <CardTitle className="text-xs font-black uppercase tracking-widest text-app-muted-foreground">Resource Concentration</CardTitle>
 <BarChart3 size={14} className="text-app-muted-foreground" />
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
 <div className="w-1.5 h-1.5 rounded-full bg-app-success/10" />
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-tight truncate max-w-[120px]">{e.first_name} {e.last_name}</span>
 </div>
 <span className="text-[10px] font-mono font-bold text-app-muted-foreground">{fmt(salary)}</span>
 </div>
 <div className="relative h-2 bg-app-surface-2 rounded-full overflow-hidden">
 <div
 className="absolute inset-y-0 left-0 bg-app-primary rounded-full transition-all duration-1000 group-hover:bg-app-success/10"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
 })}
 {filtered.length > 10 && (
 <div className="pt-4 border-t border-stone-50 text-center">
 <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Showing top concentration nodes</p>
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2.5rem] border-0 shadow-sm bg-app-surface text-app-foreground p-8 relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
 <TrendingUp size={120} />
 </div>
 <div className="relative z-10">
 <h3 className="text-xl font-black tracking-tighter mb-2">Liability Pulse</h3>
 <p className="text-app-muted-foreground text-[10px] font-black uppercase tracking-widest leading-relaxed">
 Total annual operational liability currently calculated at
 </p>
 <div className="text-4xl font-black text-app-primary mt-4 tracking-tighter">
 {fmt(totalPayroll * 12)}
 </div>
 <Button className="w-full mt-8 bg-app-foreground/10 hover:bg-app-foreground/20 text-app-foreground rounded-xl font-black uppercase text-[10px] tracking-widest border border-app-text/10 group">
 Generate Audit Manifest <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
 </Button>
 </div>
 </Card>
 </div>
 </div>
 </div>
 );
}
