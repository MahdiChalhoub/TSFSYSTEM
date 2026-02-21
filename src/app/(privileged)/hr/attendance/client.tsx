'use client'

import { useState, useTransition } from "react"
import { createAttendance, checkIn, checkOut } from "@/app/actions/hr"
import { toast } from "sonner"
import { Plus, LogIn, LogOut, Clock, UserCheck, AlertCircle } from "lucide-react"

interface Props {
    attendance: any[]
    employees: any[]
    shifts: any[]
}

export default function AttendanceClient({ attendance, employees, shifts }: Props) {
    const [showForm, setShowForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [filter, setFilter] = useState<'all' | 'today'>('today')

    const today = new Date().toISOString().split('T')[0]
    const displayed = filter === 'today'
        ? attendance.filter(a => a.date === today || a.created_at?.startsWith(today))
        : attendance

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await createAttendance({
                    employee: fd.get('employee'),
                    shift: fd.get('shift') || null,
                    date: fd.get('date'),
                })
                toast.success('Attendance record created')
                setShowForm(false)
            } catch (err: any) { toast.error(err.message || 'Failed') }
        })
    }

    const handleCheckIn = (id: string) => startTransition(async () => {
        try { await checkIn(id); toast.success('Checked in!') }
        catch (err: any) { toast.error(err.message) }
    })

    const handleCheckOut = (id: string) => startTransition(async () => {
        try { await checkOut(id); toast.success('Checked out!') }
        catch (err: any) { toast.error(err.message) }
    })

    const getEmpName = (id: string) => {
        const e = employees.find((emp: any) => emp.id === id)
        return e ? `${e.first_name} ${e.last_name}` : id
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    {(['today', 'all'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === f
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
                            {f === 'today' ? 'Today' : 'All Records'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                    <Plus size={18} /> New Record
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Employee</label>
                            <select name="employee" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-400 outline-none">
                                <option value="">Select...</option>
                                {employees.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Shift</label>
                            <select name="shift" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-400 outline-none">
                                <option value="">— None —</option>
                                {shifts.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Date</label>
                            <input name="date" type="date" defaultValue={today} required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-400 outline-none" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setShowForm(false)}
                            className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isPending}
                            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                            {isPending ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Check In</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Check Out</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                                <Clock size={36} className="mx-auto mb-3 opacity-30" />
                                <p className="font-semibold">No attendance records</p>
                            </td></tr>
                        )}
                        {displayed.map((a: any) => {
                            const hasIn = !!a.check_in
                            const hasOut = !!a.check_out
                            const statusColor = !hasIn ? 'text-gray-400' : hasOut ? 'text-emerald-600' : 'text-amber-600'
                            const statusText = !hasIn ? 'Pending' : hasOut ? 'Completed' : 'On-site'

                            return (
                                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-900">{a.employee_name || getEmpName(a.employee)}</td>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">{a.date || a.created_at?.split('T')[0]}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{a.check_in ? new Date(a.check_in).toLocaleTimeString() : '—'}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{a.check_out ? new Date(a.check_out).toLocaleTimeString() : '—'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-black uppercase tracking-wider ${statusColor}`}>{statusText}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {!hasIn && (
                                                <button onClick={() => handleCheckIn(a.id)} disabled={isPending}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors">
                                                    <LogIn size={14} /> Check In
                                                </button>
                                            )}
                                            {hasIn && !hasOut && (
                                                <button onClick={() => handleCheckOut(a.id)} disabled={isPending}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors">
                                                    <LogOut size={14} /> Check Out
                                                </button>
                                            )}
                                            {hasIn && hasOut && (
                                                <span className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold">
                                                    <UserCheck size={14} /> Done
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
