'use client';

import { useState, useTransition, useCallback } from 'react';
import { createAttendance, checkIn, checkOut } from "@/app/actions/hr";
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { toast } from 'sonner';
import { Plus, LogIn, LogOut, Clock, UserCheck, AlertCircle, Fingerprint, Calendar, Timer, RefreshCw } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type AttendanceRecord = Record<string, any>;

const ALL_COLUMNS: ColumnDef<AttendanceRecord>[] = [
    { key: 'employee', label: 'Employee', sortable: true, alwaysVisible: true },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'check_in', label: 'Check-In' },
    { key: 'check_out', label: 'Check-Out' },
    { key: 'duration', label: 'Duration', align: 'right' },
];

export default function TimeAttendanceLedger({
    attendance,
    employees,
    shifts
}: {
    attendance: AttendanceRecord[],
    employees: any[],
    shifts: any[]
}) {
    const settings = useListViewSettings('hr_attendance_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 20,
        sortKey: 'date',
        sortDir: 'desc',
    });

    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState('today');
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const filtered = attendance.filter(a => {
        const matchesSearch = (a.employee_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesDate = filter === 'today' ? (a.date === today || a.created_at?.startsWith(today)) : true;
        return matchesSearch && matchesDate;
    });

    const handleCheckIn = (id: string) => startTransition(async () => {
        try {
            await checkIn(id);
            toast.success('Checked in');
        } catch (err: any) { toast.error(err.message) }
    });

    const handleCheckOut = (id: string) => startTransition(async () => {
        try {
            await checkOut(id);
            toast.success('Checked out');
        } catch (err: any) { toast.error(err.message) }
    });

    const columns: ColumnDef<AttendanceRecord>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: AttendanceRecord) => React.ReactNode> = {
            employee: r => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Fingerprint size={16} />
                    </div>
                    <span className="font-bold text-gray-900 uppercase tracking-tight">{r.employee_name || 'Employee'}</span>
                </div>
            ),
            date: r => (
                <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 bg-stone-50 px-2 py-1 rounded-lg border border-stone-100">
                    <Calendar size={12} className="text-gray-400" />
                    {r.date || r.created_at?.split('T')[0]}
                </div>
            ),
            check_in: r => r.check_in ? (
                <span className="text-xs font-black text-gray-700 font-mono italic">
                    {new Date(r.check_in).toLocaleTimeString()}
                </span>
            ) : <span className="text-gray-300 font-mono">—</span>,
            check_out: r => r.check_out ? (
                <span className="text-xs font-black text-gray-700 font-mono italic">
                    {new Date(r.check_out).toLocaleTimeString()}
                </span>
            ) : <span className="text-gray-300 font-mono">—</span>,
            duration: r => {
                if (!r.check_in || !r.check_out) return <span className="text-gray-300">—</span>;
                const diff = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return (
                    <div className="flex items-center justify-end gap-1.5 text-xs font-black text-emerald-600">
                        <Timer size={14} />
                        {hours}h {mins}m
                    </div>
                );
            }
        };
        return { ...c, render: renderers[c.key] };
    });

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            try {
                await createAttendance({
                    employee: fd.get('employee'),
                    shift: fd.get('shift') || null,
                    date: fd.get('date'),
                });
                toast.success('Attendance recorded');
                setIsDialogOpen(false);
            } catch (err: any) { toast.error(err.message || 'Sync Failed') }
        });
    };

    return (
        <div className="space-y-6">
            <TypicalListView<AttendanceRecord>
                title="Attendance Log"
                data={filtered}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                className="rounded-[32px] border-0 shadow-sm overflow-hidden"
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                headerExtra={
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-6 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all">
                                <Plus size={18} className="mr-2" /> Add Record
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden max-w-lg">
                            <div className="bg-emerald-600 p-8 text-white relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Fingerprint size={80} />
                                </div>
                                <h2 className="text-3xl font-black tracking-tighter">New <span className="opacity-60">Record</span></h2>
                                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Record Attendance</p>
                            </div>
                            <form onSubmit={handleCreate} className="p-8 space-y-6 bg-white">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Employee</label>
                                        <select name="employee" required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none appearance-none">
                                            <option value="">Select Employee...</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Assigned Shift</label>
                                            <select name="shift" className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none appearance-none">
                                                <option value="">None</option>
                                                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Date</label>
                                            <input name="date" type="date" defaultValue={today} required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-gray-100">Cancel</Button>
                                    <Button type="submit" disabled={isPending} className="flex-1 h-12 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100">
                                        {isPending ? 'Saving...' : 'Submit'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                }
                lifecycle={{
                    getStatus: r => {
                        const hasIn = !!r.check_in;
                        const hasOut = !!r.check_out;
                        if (!hasIn) return { label: 'Not clocked in', variant: 'warning' };
                        if (hasOut) return { label: 'Completed', variant: 'success' };
                        return { label: 'Clocked In', variant: 'default' };
                    }
                }}
                actions={{
                    extra: (r) => {
                        const hasIn = !!r.check_in;
                        const hasOut = !!r.check_out;
                        return (
                            <div className="flex gap-2">
                                {!hasIn && (
                                    <Button onClick={() => handleCheckIn(r.id)} disabled={isPending} variant="ghost" className="h-8 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        <LogIn size={12} className="mr-1.5" /> Start
                                    </Button>
                                )}
                                {hasIn && !hasOut && (
                                    <Button onClick={() => handleCheckOut(r.id)} disabled={isPending} variant="ghost" className="h-8 px-3 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        <LogOut size={12} className="mr-1.5" /> Clock Out
                                    </Button>
                                )}
                                {hasIn && hasOut && (
                                    <div className="h-8 px-3 bg-stone-50 text-stone-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center">
                                        Verified
                                    </div>
                                )}
                            </div>
                        )
                    }
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search employees...', value: search, onChange: setSearch }}
                    filters={[
                        {
                            key: 'period', label: 'Time Period', type: 'select', options: [
                                { value: 'today', label: 'Today' },
                                { value: 'all', label: 'All Records' }
                            ]
                        }
                    ]}
                    values={{ period: filter }}
                    onChange={(k, v) => setFilter(String(v))}
                />
            </TypicalListView>
        </div>
    );
}
