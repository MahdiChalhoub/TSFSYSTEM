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

            {/* Header: Human Capital Intelligence */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-teal-50 text-teal-600 border-teal-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Human Capital: Synchronized
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> Sync: Direct
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-teal-600 flex items-center justify-center shadow-2xl shadow-teal-200">
                            <Users size={32} className="text-white fill-white" />
                        </div>
                        Talent <span className="text-teal-600">Ops</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={load} className="h-12 px-6 rounded-2xl bg-white border border-gray-100 shadow-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                        <RefreshCw size={18} /> Refresh Hub
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-teal-600 text-white font-bold flex items-center gap-2 hover:bg-teal-700 transition-all shadow-lg shadow-teal-200">
                        Staff Audit <ChevronRight size={18} />
                    </button>
                </div>
            </header>

            {/* Premium KPI Node Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <Badge variant="outline" className="text-cyan-500 bg-cyan-50 border-0 font-black text-[10px]">
                            ROSTER
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Employees</p>
                    <h2 className="text-3xl font-black text-gray-900">{employees.length}</h2>
                </div>

                <div className="bg-teal-900 p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-800/50 text-teal-100 flex items-center justify-center">
                            <UserCheck size={24} />
                        </div>
                        <Badge variant="outline" className="text-teal-200 bg-teal-800/30 border-0 font-black text-[10px]">
                            ACTIVE
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-teal-300 uppercase tracking-widest leading-none mb-1">Human Capital</p>
                    <h2 className="text-3xl font-black text-white">{activeEmp.length} <span className="text-xs text-teal-200">STAFF</span></h2>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <Badge variant="outline" className="text-indigo-500 bg-indigo-50 border-0 font-black text-[10px]">
                            PRESENT
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Daily Attendance</p>
                    <h2 className="text-3xl font-black text-gray-900">{presentToday}</h2>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <Badge variant="outline" className="text-amber-500 bg-amber-50 border-0 font-black text-[10px]">
                            {pending.length} ACTION
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Pending Leaves</p>
                    <h2 className="text-3xl font-black text-gray-900">{pending.length}</h2>
                </div>
            </div>

            {/* Departments: Node Chips */}
            {departments.length > 0 && (
                <div className="flex gap-2 flex-wrap pb-4">
                    {departments.map(dept => (
                        <div key={dept.id} className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-teal-200 transition-all">
                            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-all">
                                <Building2 size={12} />
                            </div>
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{dept.name}</span>
                            {dept.employee_count != null && <Badge variant="outline" className="bg-slate-50 border-0 text-[8px] font-black text-gray-400">{dept.employee_count}</Badge>}
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
                                    <div key={leave.id} className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white shadow-sm border border-slate-50 transition-all hover:shadow-md group text-gray-900">
                                        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-all font-black text-xs uppercase">
                                            {leave.leave_type?.[0] || 'L'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-black text-sm uppercase italic truncate">{name}</span>
                                                <Badge className={`${STATUS_BADGE[leave.status] || 'bg-gray-100 text-gray-400'} border-0 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest`}>{leave.status}</Badge>
                                                {leave.leave_type && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{leave.leave_type}</span>}
                                            </div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">
                                                {leave.start_date} <span className="text-gray-300 italic mx-1">UNTIL</span> {leave.end_date}
                                                {leave.reason ? ` · ${leave.reason}` : ''}
                                            </p>
                                        </div>
                                        {leave.status === 'PENDING' && (
                                            <div className="flex gap-3">
                                                <button onClick={() => handleLeave(leave.id, 'approve')} className="h-10 px-6 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all">
                                                    Approve
                                                </button>
                                                <button onClick={() => handleLeave(leave.id, 'reject')} className="h-10 px-6 rounded-2xl bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all">
                                                    Reject
                                                </button>
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
