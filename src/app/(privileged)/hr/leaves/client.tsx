'use client'

import { useState, useTransition } from "react"
import { createLeave, approveLeave, rejectLeave } from "@/app/actions/hr"
import { toast } from "sonner"
import { Plus, Check, X, Clock, CalendarOff, AlertCircle } from "lucide-react"

interface Props {
    leaves: any[]
    employees: any[]
}

const LEAVE_TYPES = [
    { value: 'ANNUAL', label: 'Annual Leave' },
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'MATERNITY', label: 'Maternity Leave' },
    { value: 'PATERNITY', label: 'Paternity Leave' },
    { value: 'UNPAID', label: 'Unpaid Leave' },
    { value: 'COMPENSATORY', label: 'Compensatory' },
    { value: 'OTHER', label: 'Other' },
]

const STATUS_STYLES: Record<string, string> = {
    'PENDING': 'bg-amber-50 text-amber-700 border-amber-200',
    'APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'REJECTED': 'bg-rose-50 text-rose-700 border-rose-200',
    'CANCELLED': 'bg-app-surface text-app-muted-foreground border-app-border',
}

export default function LeavesClient({ leaves, employees }: Props) {
    const [showForm, setShowForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [filter, setFilter] = useState<string>('ALL')

    const displayed = filter === 'ALL' ? leaves : leaves.filter(l => l.status === filter)

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await createLeave({
                    employee: fd.get('employee'),
                    leave_type: fd.get('leave_type'),
                    start_date: fd.get('start_date'),
                    end_date: fd.get('end_date'),
                    reason: fd.get('reason'),
                })
                toast.success('Leave request submitted')
                setShowForm(false)
            } catch (err: any) { toast.error(err.message || 'Failed') }
        })
    }

    const handleApprove = (id: string) => startTransition(async () => {
        try { await approveLeave(id); toast.success('Leave approved') }
        catch (err: any) { toast.error(err.message) }
    })

    const handleReject = (id: string) => startTransition(async () => {
        try { await rejectLeave(id); toast.success('Leave rejected') }
        catch (err: any) { toast.error(err.message) }
    })

    const getEmpName = (id: string) => {
        const e = employees.find((emp: any) => emp.id === id)
        return e ? `${e.first_name} ${e.last_name}` : id
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex gap-2">
                    {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === f
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                                : 'bg-app-surface text-app-muted-foreground border border-app-border hover:bg-app-surface'}`}>
                            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200">
                    <Plus size={18} /> New Request
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-app-surface p-8 rounded-3xl border border-rose-100 shadow-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-wider mb-2">Employee</label>
                            <select name="employee" required className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-rose-400 outline-none">
                                <option value="">Select...</option>
                                {employees.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-wider mb-2">Leave Type</label>
                            <select name="leave_type" required className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-rose-400 outline-none">
                                {LEAVE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-wider mb-2">Start Date</label>
                            <input name="start_date" type="date" required
                                className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-rose-400 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-wider mb-2">End Date</label>
                            <input name="end_date" type="date" required
                                className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-rose-400 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-wider mb-2">Reason</label>
                        <textarea name="reason" rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-rose-400 outline-none resize-none" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setShowForm(false)}
                            className="px-6 py-3 rounded-xl border border-app-border font-bold text-app-muted-foreground hover:bg-app-surface">Cancel</button>
                        <button type="submit" disabled={isPending}
                            className="px-8 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50">
                            {isPending ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {displayed.length === 0 && (
                    <div className="text-center py-20 text-app-muted-foreground">
                        <CalendarOff size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">No leave requests</p>
                    </div>
                )}
                {displayed.map((l: any) => (
                    <div key={l.id} className="bg-app-surface p-6 rounded-2xl border border-app-border hover:shadow-lg transition-all group flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                                <CalendarOff size={20} className="text-rose-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-bold text-app-foreground">{l.employee_name || getEmpName(l.employee)}</span>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${STATUS_STYLES[l.status] || STATUS_STYLES['PENDING']}`}>
                                        {l.status}
                                    </span>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                        {LEAVE_TYPES.find(t => t.value === l.leave_type)?.label || l.leave_type}
                                    </span>
                                </div>
                                <div className="text-sm text-app-muted-foreground flex items-center gap-4">
                                    <span className="font-mono">{l.start_date} → {l.end_date}</span>
                                    {l.reason && <span className="truncate max-w-xs">· {l.reason}</span>}
                                </div>
                            </div>
                        </div>

                        {l.status === 'PENDING' && (
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleApprove(l.id)} disabled={isPending}
                                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm">
                                    <Check size={14} /> Approve
                                </button>
                                <button onClick={() => handleReject(l.id)} disabled={isPending}
                                    className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-200 transition-all">
                                    <X size={14} /> Reject
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
