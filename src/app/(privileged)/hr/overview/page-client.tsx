'use client'
import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    Users, Building2, Clock, CalendarDays, CheckCircle, XCircle,
    RefreshCw, ChevronRight, AlertTriangle, UserCheck, TrendingUp,
    Activity, Briefcase, MapPin, ShieldCheck, Mail
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
type Employee = { id: number; first_name: string; last_name: string; department?: { name: string }; position?: string; employment_type?: string; status?: string; first_name_ar?: string; last_name_ar?: string }
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
        PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
        APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
        PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
        LATE: 'bg-amber-100 text-amber-700 border-amber-200',
    }
    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 text-sm font-bold border ${toast.type === 'ok' ? 'bg-white border-emerald-100 text-emerald-600' : 'bg-white border-rose-100 text-rose-600 animate-bounce'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    {toast.msg}
                </div>
            )}
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Users size={28} className="text-white" />
                        </div>
                        Talent <span className="text-emerald-600">Ops</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Human Capital Intelligence & Workforce Hub</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={load} className={`h-12 w-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-all ${loading ? 'animate-spin' : ''}`}>
                        <RefreshCw size={20} />
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-gray-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center gap-2">
                        Resource Audit <ChevronRight size={16} />
                    </button>
                </div>
            </header>
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-white text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <Users size={24} />
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                <Activity size={10} className="text-emerald-600 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Realtime</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Registered Personnel</p>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter">{employees.length}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-emerald-600 to-emerald-700 overflow-hidden group hover:shadow-xl transition-all text-white">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm backdrop-blur-sm">
                                <Briefcase size={24} />
                            </div>
                            <Badge className="bg-white/20 text-white border-0 font-black text-[10px] px-3">ACTIVE</Badge>
                        </div>
                        <p className="text-[11px] font-black text-emerald-200 uppercase tracking-widest leading-none mb-1">Human Capital Yield</p>
                        <h2 className="text-4xl font-black text-white tracking-tighter">{activeEmp.length} <span className="text-xs text-emerald-300 font-medium">STAFF</span></h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <UserCheck size={24} />
                            </div>
                            <div className="flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-indigo-600 uppercase">Live Tracking</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Daily Attendance</p>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter">{presentToday}</h2>
                    </CardContent>
                </Card>
                <Card className={`rounded-[2rem] border-0 shadow-sm bg-gradient-to-br transition-all overflow-hidden group hover:shadow-md ${pending.length > 0 ? 'from-amber-50 to-white border border-amber-100' : 'from-slate-50 to-white'}`}>
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${pending.length > 0 ? 'bg-white text-amber-600' : 'bg-white text-slate-400'}`}>
                                <AlertTriangle size={24} />
                            </div>
                            {pending.length > 0 && <Badge className="bg-amber-500 text-white border-0 font-black text-[10px] px-3 animate-pulse">ACTION REQ.</Badge>}
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Pending Leave Auth</p>
                        <h2 className={`text-4xl font-black tracking-tighter ${pending.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pending.length}</h2>
                    </CardContent>
                </Card>
            </div>
            {/* Departments Section */}
            {departments.length > 0 && (
                <div className="flex gap-2 flex-wrap pb-2">
                    {departments.map(dept => (
                        <div key={dept.id} className="flex items-center gap-3 px-5 py-2.5 rounded-[1.25rem] bg-white border border-slate-100 shadow-sm group hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Building2 size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{dept.name}</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Nodes: {dept.employee_count ?? 0}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* Workbench Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex gap-1 bg-slate-100/50 rounded-2xl p-1.5 w-fit border border-slate-100">
                        {([['leaves', 'Authorization Requests', CalendarDays], ['attendance', 'Presence Monitoring', Clock], ['employees', 'Workforce Directory', Users]] as const).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-[1rem] text-xs font-black uppercase tracking-widest transition-all ${tab === key ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-900'}`}
                            >
                                <Icon size={14} />
                                {label}
                                {key === 'leaves' && pending.length > 0 && <span className="bg-amber-500 text-white text-[9px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full ml-1">{pending.length}</span>}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white/50 border border-slate-100 rounded-[2rem] animate-pulse" />)
                    ) : tab === 'leaves' ? (
                        leaves.length === 0 ? <div className="text-sm font-bold text-gray-300 py-20 text-center uppercase tracking-[0.2em] bg-white rounded-[2rem] border border-dashed border-slate-200">No active leave drafts</div> :
                            leaves.map(leave => {
                                const name = leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : (leave.employee_name || '—')
                                return (
                                    <div key={leave.id} className="flex items-center gap-6 p-6 rounded-[2rem] bg-white shadow-sm border border-slate-50 group hover:shadow-xl hover:border-emerald-100 transition-all text-gray-900">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all font-black text-xl">
                                            {leave.leave_type?.[0] || 'L'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-black text-base tracking-tight text-gray-900">{name}</span>
                                                <Badge className={`${STATUS_BADGE[leave.status] || 'bg-gray-100 text-gray-400'} border-none text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest`}>{leave.status}</Badge>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <CalendarDays size={12} className="text-emerald-500" />
                                                    {leave.start_date} <ChevronRight size={10} className="text-gray-300" /> {leave.end_date}
                                                </p>
                                                {leave.leave_type && <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded uppercase tracking-widest">{leave.leave_type}</span>}
                                            </div>
                                        </div>
                                        <div className="hidden lg:block max-w-[30%] px-6 border-x border-slate-50">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Governance Insight</p>
                                            <p className="text-xs text-gray-500 font-medium line-clamp-2 italic">"{leave.reason || 'No justification provided'}"</p>
                                        </div>
                                        {leave.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleLeave(leave.id, 'approve')} className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                                                    Approve
                                                </button>
                                                <button onClick={() => handleLeave(leave.id, 'reject')} className="h-10 px-6 rounded-xl bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all">
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                    ) : tab === 'attendance' ? (
                        attendance.length === 0 ? <div className="text-sm font-bold text-gray-300 py-20 text-center uppercase tracking-[0.2em] bg-white rounded-[2rem] border border-dashed border-slate-200">No presence data detected</div> :
                            attendance.map(att => {
                                const name = att.employee ? `${att.employee.first_name} ${att.employee.last_name}` : (att.employee_name || '—')
                                return (
                                    <div key={att.id} className="flex items-center gap-6 p-5 rounded-[1.5rem] bg-white border border-slate-100 group hover:border-emerald-100 transition-all">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${att.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            <UserCheck size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-sm text-gray-900 tracking-tight">{name}</span>
                                                <Badge className={`${STATUS_BADGE[att.status] || 'bg-gray-100 text-gray-400'} border-none text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-tighter`}>{att.status}</Badge>
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                                <MapPin size={10} className="text-slate-300" /> Primary Terminal · {att.date || '—'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-8 text-right px-8">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">CHECK-IN</p>
                                                <p className="text-xs font-black text-gray-900">{att.check_in || '—:—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">CHECK-OUT</p>
                                                <p className="text-xs font-black text-gray-900">{att.check_out || '—:—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                    ) : (
                        employees.length === 0 ? <div className="text-sm font-bold text-gray-300 py-20 text-center uppercase tracking-[0.2em] bg-white rounded-[2rem] border border-dashed border-slate-200">Workforce roster is empty</div> :
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {employees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-5 p-6 rounded-[2rem] bg-white border border-slate-100 hover:shadow-lg transition-all group">
                                        <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-slate-50 text-emerald-600 flex items-center justify-center text-xl font-black shrink-0 shadow-inner group-hover:from-emerald-600 group-hover:to-emerald-700 group-hover:text-white transition-all">
                                            {emp.first_name?.[0]}{emp.last_name?.[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-gray-900 tracking-tight truncate">{emp.first_name} {emp.last_name}</h4>
                                                <Badge className={`${emp.status === 'ACTIVE' || !emp.status ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'} border-none text-[8px] font-black px-2 py-0.5 rounded uppercase`}>
                                                    {emp.status || 'ACTIVE'}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Briefcase size={12} className="text-slate-300 shrink-0" />
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{emp.position || 'Specialist'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Building2 size={12} className="text-slate-300 shrink-0" />
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter truncate">{emp.department?.name || 'GEN-OPS'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                                                <Mail size={16} />
                                            </button>
                                            <button className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                                                <ShieldCheck size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    )
                    }
                </div>
            </div>
        </div>
    )
}
