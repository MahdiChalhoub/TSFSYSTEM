'use client';

import { useState, useTransition, useCallback } from 'react';
import { createLeave, approveLeave, rejectLeave } from "@/app/actions/hr";
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { toast } from 'sonner';
import { Plus, Check, X, Clock, CalendarOff, AlertCircle, Calendar, User, FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type LeaveRequest = Record<string, any>;

const LEAVE_TYPES = [
    { value: 'ANNUAL', label: 'Annual Leave' },
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'MATERNITY', label: 'Maternity Leave' },
    { value: 'PATERNITY', label: 'Paternity Leave' },
    { value: 'UNPAID', label: 'Unpaid Leave' },
    { value: 'COMPENSATORY', label: 'Compensatory' },
    { value: 'OTHER', label: 'Other Nature' },
];

const ALL_COLUMNS: ColumnDef<LeaveRequest>[] = [
    { key: 'employee', label: 'Resource Entity', sortable: true, alwaysVisible: true },
    { key: 'type', label: 'Leave Protocol' },
    { key: 'duration', label: 'Temporal Scope' },
    { key: 'reason', label: 'Disposition / Reason' },
];

export default function LeaveManagementHub({
    leaves,
    employees
}: {
    leaves: LeaveRequest[],
    employees: any[]
}) {
    const settings = useListViewSettings('hr_leaves_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 20,
        sortKey: 'employee',
        sortDir: 'asc',
    });

    const [isPending, startTransition] = useTransition();
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const filtered = leaves.filter(l => {
        const matchesSearch = (l.employee_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleApprove = (id: string) => startTransition(async () => {
        try {
            await approveLeave(id);
            toast.success('Protocol Exception Authorized');
        } catch (err: any) { toast.error(err.message) }
    });

    const handleReject = (id: string) => startTransition(async () => {
        try {
            await rejectLeave(id);
            toast.success('Protocol Exception Terminated');
        } catch (err: any) { toast.error(err.message) }
    });

    const columns: ColumnDef<LeaveRequest>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: LeaveRequest) => React.ReactNode> = {
            employee: r => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <User size={16} />
                    </div>
                    <span className="font-bold text-gray-900 uppercase tracking-tight">{r.employee_name || 'Personnel Resource'}</span>
                </div>
            ),
            type: r => {
                const typeLabel = LEAVE_TYPES.find(t => t.value === r.leave_type)?.label || r.leave_type;
                return (
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-0 font-black text-[10px] uppercase tracking-tighter">
                        {typeLabel}
                    </Badge>
                );
            },
            duration: r => (
                <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 bg-stone-50 px-2 py-1 rounded-lg border border-stone-100 italic">
                    <Calendar size={12} className="text-gray-400" />
                    {r.start_date} <ChevronRight size={10} /> {r.end_date}
                </div>
            ),
            reason: r => (
                <div className="flex items-center gap-2 max-w-xs">
                    <FileText size={12} className="text-gray-400 shrink-0" />
                    <span className="text-xs font-medium text-gray-600 truncate">{r.reason || 'No justification provided'}</span>
                </div>
            )
        };
        return { ...c, render: renderers[c.key] };
    });

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            try {
                await createLeave({
                    employee: fd.get('employee'),
                    leave_type: fd.get('leave_type'),
                    start_date: fd.get('start_date'),
                    end_date: fd.get('end_date'),
                    reason: fd.get('reason'),
                });
                toast.success('Leave Request Protocol Submitted');
                setIsDialogOpen(false);
            } catch (err: any) { toast.error(err.message || 'Submission Failed') }
        });
    };

    return (
        <div className="space-y-6">
            <TypicalListView<LeaveRequest>
                title="Personnel Leave Ledger"
                data={filtered}
                getRowId={r => r.id}
                columns={columns}
                className="rounded-[32px] border-0 shadow-sm overflow-hidden"
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                headerExtra={
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-6 bg-rose-600 text-white hover:bg-rose-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100 transition-all">
                                <Plus size={18} className="mr-2" /> New Request Protocol
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden max-w-xl">
                            <div className="bg-rose-600 p-8 text-white relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <CalendarOff size={80} />
                                </div>
                                <h2 className="text-3xl font-black tracking-tighter">Submit <span className="opacity-60">Protocol</span></h2>
                                <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Leave Application & Exception Approval</p>
                            </div>
                            <form onSubmit={handleCreate} className="p-8 space-y-6 bg-white">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Personnel Entity</label>
                                        <select name="employee" required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 outline-none appearance-none">
                                            <option value="">Select Resource...</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Leave Dimension</label>
                                        <select name="leave_type" required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 outline-none appearance-none">
                                            {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 col-span-2">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Start Segment</label>
                                            <input name="start_date" type="date" required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">End Segment</label>
                                            <input name="end_date" type="date" required className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 outline-none" />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Justification / Reason</label>
                                        <textarea name="reason" rows={2} className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 outline-none resize-none" placeholder="Provide operational justification..." />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-gray-100">Cancel</Button>
                                    <Button type="submit" disabled={isPending} className="flex-1 h-12 bg-rose-600 text-white hover:bg-rose-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-100">
                                        {isPending ? 'Processing...' : 'Submit Protocol'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                }
                lifecycle={{
                    getStatus: r => {
                        const sMap: Record<string, any> = {
                            'PENDING': { label: 'Awaiting Authorization', variant: 'warning' },
                            'APPROVED': { label: 'Authorized', variant: 'success' },
                            'REJECTED': { label: 'Terminated', variant: 'destructive' },
                            'CANCELLED': { label: 'Cancelled', variant: 'secondary' },
                        };
                        return sMap[r.status] || sMap['PENDING'];
                    }
                }}
                actions={{
                    extra: (r) => (
                        r.status === 'PENDING' ? (
                            <div className="flex gap-2">
                                <Button onClick={() => handleApprove(r.id)} disabled={isPending} variant="ghost" className="h-8 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    <Check size={12} className="mr-1.5" /> Approve
                                </Button>
                                <Button onClick={() => handleReject(r.id)} disabled={isPending} variant="ghost" className="h-8 px-3 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    <X size={12} className="mr-1.5" /> Reject
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                <CheckCircle2 size={12} /> Decision Locked
                            </div>
                        )
                    )
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search Personnel Identities...', value: search, onChange: setSearch }}
                    filters={[
                        {
                            key: 'status', label: 'Protocol Status', type: 'select', options: [
                                { value: 'ALL', label: 'All Lifecycle States' },
                                { value: 'PENDING', label: 'Awaiting Authorization' },
                                { value: 'APPROVED', label: 'Authorized Archives' },
                                { value: 'REJECTED', label: 'Terminated Archive' },
                            ]
                        }
                    ]}
                    values={{ status: statusFilter }}
                    onChange={(k, v) => setStatusFilter(String(v))}
                />
            </TypicalListView>
        </div>
    );
}
