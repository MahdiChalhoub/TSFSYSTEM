'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Users, Building2, Clock, CalendarDays, CheckCircle, XCircle, RefreshCw, ChevronRight, AlertTriangle, UserCheck, TrendingUp } from 'lucide-react'

type Employee = { id: number; first_name: string; last_name: string; department?: { name: string }; position?: string; employment_type?: string; status?: string }
type Department = { id: number; name: string; employee_count?: number }
type Attendance = { id: number; employee?: { first_name: string; last_name: string }; employee_name?: string; check_in?: string; check_out?: string; status: string; date?: string }
type Leave = { id: number; employee?: { first_name: string; last_name: string }; employee_name?: string; leave_type?: string; start_date: string; end_date: string; status: string; reason?: string }

export default function HROverviewPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [attendance, setAttendance] = useState<Attendance[]>([])
    const [leaves, setLeaves] = useState<Leave[]>([])
    const [tab, setTab] = useState<'attendance' | 'leaves' | 'employees'>('leaves')
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const [emp, dept, att, lv] = await Promise.allSettled([
            erpFetch('hr/employees/'),
            erpFetch('hr/departments/'),
            erpFetch('hr/attendance/'),
            erpFetch('hr/leaves/'),
        ])
        setEmployees(emp.status === 'fulfilled' ? (Array.isArray(emp.value) ? emp.value : emp.value?.results ?? []) : [])
        setDepartments(dept.status === 'fulfilled' ? (Array.isArray(dept.value) ? dept.value : dept.value?.results ?? []) : [])
        setAttendance(att.status === 'fulfilled' ? (Array.isArray(att.value) ? att.value : att.value?.results ?? []) : [])
        setLeaves(lv.status === 'fulfilled' ? (Array.isArray(lv.value) ? lv.value : lv.value?.results ?? []) : [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleLeave(id: number, action: 'approve' | 'reject') {
        try {
            await erpFetch(`hr/leaves/${id}/${action}/`, { method: 'POST' })
            showToast(`Leave ${action}d`, 'ok')
            load()
        } catch { showToast('Action failed', 'err') }
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const pending = leaves.filter(l => l.status === 'PENDING')
    const presentToday = attendance.filter(a => a.status === 'PRESENT' || a.check_in).length
    const activeEmp = employees.filter(e => !e.status || e.status === 'ACTIVE')

    const STATUS_BADGE: Record<string, string> = {
        PENDING: 'bg-amber-900/40 text-amber-400 border-amber-700',
        APPROVED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
        REJECTED: 'bg-red-900/40 text-red-400 border-red-800',
        PRESENT: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
        ABSENT: 'bg-red-900/40 text-red-400 border-red-800',
        LATE: 'bg-amber-900/40 text-amber-400 border-amber-700',
    }

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-900/40">
                        <Users size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Users size={28} className="text-white" />
                            </div>
                            HR <span className="text-indigo-600">Overview</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Human Resources</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Employees', value: employees.length, icon: Users, color: 'cyan' },
                    { label: 'Active', value: activeEmp.length, icon: UserCheck, color: 'emerald' },
                    { label: 'Present Today', value: presentToday, icon: TrendingUp, color: 'blue' },
                    { label: 'Pending Leaves', value: pending.length, icon: AlertTriangle, color: pending.length > 0 ? 'amber' : 'gray' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><s.icon size={14} />{s.label}</div>
                        <div className={`text-3xl font-bold text-${s.color}-400`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Departments mini grid */}
            {departments.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                    {departments.map(dept => (
                        <div key={dept.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0F1729] border border-gray-800">
                            <Building2 size={13} className="text-teal-400" />
                            <span className="text-sm text-gray-300">{dept.name}</span>
                            {dept.employee_count != null && <span className="text-xs text-gray-600 font-mono">({dept.employee_count})</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* Tab switcher */}
            <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-1.5 w-fit">
                {([['leaves', 'Leave Requests', CalendarDays], ['attendance', 'Attendance', Clock], ['employees', 'Employees', Users]] as const).map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40' : 'text-gray-400 hover:text-gray-200'}`}>
                        <Icon size={14} />
                        {label}
                        {key === 'leaves' && pending.length > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full">{pending.length}</span>}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-col gap-2">
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />) :

                    tab === 'leaves' ? (
                        leaves.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No leave requests</div> :
                            leaves.map(leave => {
                                const name = leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : (leave.employee_name || '—')
                                return (
                                    <div key={leave.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-gray-800">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-white">{name}</span>
                                                {leave.leave_type && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">{leave.leave_type}</span>}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[leave.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{leave.status}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{leave.start_date} → {leave.end_date}{leave.reason ? ` · ${leave.reason}` : ''}</p>
                                        </div>
                                        {leave.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleLeave(leave.id, 'approve')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold"><CheckCircle size={11} />Approve</button>
                                                <button onClick={() => handleLeave(leave.id, 'reject')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-xs font-semibold"><XCircle size={11} />Reject</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                    ) : tab === 'attendance' ? (
                        attendance.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No attendance records</div> :
                            attendance.map(att => {
                                const name = att.employee ? `${att.employee.first_name} ${att.employee.last_name}` : (att.employee_name || '—')
                                return (
                                    <div key={att.id} className="flex items-center gap-4 px-5 py-3 rounded-xl bg-[#0F1729] border border-gray-800">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-white">{name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[att.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{att.status}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {att.date || '—'}
                                                {att.check_in && ` · In: ${att.check_in}`}
                                                {att.check_out && ` · Out: ${att.check_out}`}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                    ) : (
                        employees.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No employees</div> :
                            employees.map(emp => (
                                <div key={emp.id} className="flex items-center gap-4 px-5 py-3 rounded-xl bg-[#0F1729] border border-gray-800">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-600 to-cyan-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-white">{emp.first_name} {emp.last_name}</div>
                                        <div className="text-xs text-gray-500">{emp.position || '—'} {emp.department?.name ? `· ${emp.department.name}` : ''}</div>
                                    </div>
                                    {emp.employment_type && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">{emp.employment_type}</span>}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${emp.status && emp.status !== 'ACTIVE' ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-emerald-900/40 text-emerald-400 border-emerald-700'}`}>
                                        {emp.status || 'ACTIVE'}
                                    </span>
                                </div>
                            ))
                    )
                }
            </div>
        </div>
    )
}
