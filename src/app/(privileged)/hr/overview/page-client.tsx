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
 PENDING: 'bg-app-warning-bg text-app-warning border-app-warning',
 APPROVED: 'bg-app-primary-light text-app-success border-app-success',
 REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
 PRESENT: 'bg-app-primary-light text-app-success border-app-success',
 ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
 LATE: 'bg-app-warning-bg text-app-warning border-app-warning',
 }
 return (
 <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {toast && (
 <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 text-sm font-bold border ${toast.type === 'ok' ? 'bg-app-surface border-app-success/30 text-app-primary' : 'bg-app-surface border-rose-100 text-rose-600 animate-bounce'}`}>
 {toast.type === 'ok' ? <CheckCircle size={20} /> : <XCircle size={20} />}
 {toast.msg}
 </div>
 )}
 {/* Header */}
 <header className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div>
 <h1 className="text-4xl font-black tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-emerald-200">
 <Users size={28} className="text-app-foreground" />
 </div>
 Talent <span className="text-app-primary">Ops</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Human Capital Intelligence & Workforce Hub</p>
 </div>
 <div className="flex items-center gap-3">
 <button onClick={load} className={`h-12 w-12 rounded-2xl bg-app-surface border border-app-border shadow-sm flex items-center justify-center text-app-muted-foreground hover:text-app-primary transition-all ${loading ? 'animate-spin' : ''}`}>
 <RefreshCw size={20} />
 </button>
 <button className="h-12 px-6 rounded-2xl bg-app-surface text-app-foreground font-black text-xs uppercase tracking-widest hover:bg-app-background transition-all shadow-xl shadow-app-border/20 flex items-center gap-2">
 Resource Audit <ChevronRight size={16} />
 </button>
 </div>
 </header>
 {/* KPI Grid */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-7">
 <div className="flex justify-between items-start mb-6">
 <div className="w-12 h-12 rounded-2xl bg-app-surface text-app-muted-foreground flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
 <Users size={24} />
 </div>
 <div className="flex items-center gap-1.5 bg-app-primary-light px-3 py-1 rounded-full border border-app-success/30">
 <Activity size={10} className="text-app-primary animate-pulse" />
 <span className="text-[10px] font-black text-app-primary uppercase tracking-widest">Realtime</span>
 </div>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Active Employees</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter">{employees.length}</h2>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-emerald-600 to-emerald-700 overflow-hidden group hover:shadow-xl transition-all text-app-foreground">
 <CardContent className="p-7">
 <div className="flex justify-between items-start mb-6">
 <div className="w-12 h-12 rounded-2xl bg-app-foreground/10 text-app-success flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm backdrop-blur-sm">
 <Briefcase size={24} />
 </div>
 <Badge className="bg-app-foreground/20 text-app-foreground border-0 font-black text-[10px] px-3">ACTIVE</Badge>
 </div>
 <p className="text-[11px] font-black text-app-success uppercase tracking-widest leading-none mb-1">Human Capital Yield</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter">{activeEmp.length} <span className="text-xs text-app-success font-medium">STAFF</span></h2>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-7">
 <div className="flex justify-between items-start mb-6">
 <div className="w-12 h-12 rounded-2xl bg-app-surface text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
 <UserCheck size={24} />
 </div>
 <div className="flex items-center gap-1 bg-app-primary/5 px-2 py-0.5 rounded-md">
 <div className="w-1.5 h-1.5 bg-app-primary rounded-full animate-pulse" />
 <span className="text-[8px] font-black text-app-primary uppercase">Live Tracking</span>
 </div>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Daily Attendance</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter">{presentToday}</h2>
 </CardContent>
 </Card>
 <Card className={`rounded-[2rem] border-0 shadow-sm bg-gradient-to-br transition-all overflow-hidden group hover:shadow-md ${pending.length > 0 ? 'from-amber-50 to-white border border-app-warning/30' : 'from-slate-50 to-white'}`}>
 <CardContent className="p-7">
 <div className="flex justify-between items-start mb-6">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${pending.length > 0 ? 'bg-app-surface text-app-warning' : 'bg-app-surface text-app-muted-foreground'}`}>
 <AlertTriangle size={24} />
 </div>
 {pending.length > 0 && <Badge className="bg-app-warning text-app-foreground border-0 font-black text-[10px] px-3 animate-pulse">ACTION REQ.</Badge>}
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Pending Leave Auth</p>
 <h2 className={`text-4xl font-black tracking-tighter ${pending.length > 0 ? 'text-app-warning' : 'text-app-foreground'}`}>{pending.length}</h2>
 </CardContent>
 </Card>
 </div>
 {/* Departments Section */}
 {departments.length > 0 && (
 <div className="flex gap-2 flex-wrap pb-2">
 {departments.map(dept => (
 <div key={dept.id} className="flex items-center gap-3 px-5 py-2.5 rounded-[1.25rem] bg-app-surface border border-app-border shadow-sm group hover:border-app-success hover:shadow-md transition-all cursor-pointer">
 <div className="w-8 h-8 rounded-xl bg-app-background text-app-muted-foreground flex items-center justify-center group-hover:bg-app-primary-light group-hover:text-app-primary transition-all">
 <Building2 size={16} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-foreground uppercase tracking-widest">{dept.name}</p>
 <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-tighter">Nodes: {dept.employee_count ?? 0}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 {/* Workbench Section */}
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex gap-1 bg-app-surface-2/50 rounded-2xl p-1.5 w-fit border border-app-border">
 {([['leaves', 'Authorization Requests', CalendarDays], ['attendance', 'Presence Monitoring', Clock], ['employees', 'Workforce Directory', Users]] as const).map(([key, label, Icon]) => (
 <button
 key={key}
 onClick={() => setTab(key)}
 className={`flex items-center gap-2 px-6 py-2.5 rounded-[1rem] text-xs font-black uppercase tracking-widest transition-all ${tab === key ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}
 >
 <Icon size={14} />
 {label}
 {key === 'leaves' && pending.length > 0 && <span className="bg-app-warning text-app-foreground text-[9px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full ml-1">{pending.length}</span>}
 </button>
 ))}
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4">
 {loading ? (
 Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-app-foreground/50 border border-app-border rounded-[2rem] animate-pulse" />)
 ) : tab === 'leaves' ? (
 leaves.length === 0 ? <div className="text-sm font-bold text-app-muted-foreground py-20 text-center uppercase tracking-[0.2em] bg-app-surface rounded-[2rem] border border-dashed border-app-border">No active leave drafts</div> :
 leaves.map(leave => {
 const name = leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : (leave.employee_name || '—')
 return (
 <div key={leave.id} className="flex items-center gap-6 p-6 rounded-[2rem] bg-app-surface shadow-sm border border-app-border group hover:shadow-xl hover:border-app-success/30 transition-all text-app-foreground">
 <div className="w-14 h-14 rounded-2xl bg-app-background text-app-muted-foreground flex items-center justify-center shrink-0 group-hover:bg-app-primary group-hover:text-app-foreground transition-all font-black text-xl">
 {leave.leave_type?.[0] || 'L'}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <span className="font-black text-base tracking-tight text-app-foreground">{name}</span>
 <Badge className={`${STATUS_BADGE[leave.status] || 'bg-app-surface-2 text-app-muted-foreground'} border-none text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest`}>{leave.status}</Badge>
 </div>
 <div className="flex items-center gap-4">
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
 <CalendarDays size={12} className="text-app-primary" />
 {leave.start_date} <ChevronRight size={10} className="text-app-muted-foreground" /> {leave.end_date}
 </p>
 {leave.leave_type && <span className="text-[10px] font-black text-app-muted-foreground bg-app-background px-2 py-0.5 rounded uppercase tracking-widest">{leave.leave_type}</span>}
 </div>
 </div>
 <div className="hidden lg:block max-w-[30%] px-6 border-x border-app-border">
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Governance Insight</p>
 <p className="text-xs text-app-muted-foreground font-medium line-clamp-2 italic">"{leave.reason || 'No justification provided'}"</p>
 </div>
 {leave.status === 'PENDING' && (
 <div className="flex gap-2">
 <button onClick={() => handleLeave(leave.id, 'approve')} className="h-10 px-6 rounded-xl bg-app-primary text-app-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-app-success transition-all">
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
 attendance.length === 0 ? <div className="text-sm font-bold text-app-muted-foreground py-20 text-center uppercase tracking-[0.2em] bg-app-surface rounded-[2rem] border border-dashed border-app-border">No presence data detected</div> :
 attendance.map(att => {
 const name = att.employee ? `${att.employee.first_name} ${att.employee.last_name}` : (att.employee_name || '—')
 return (
 <div key={att.id} className="flex items-center gap-6 p-5 rounded-[1.5rem] bg-app-surface border border-app-border group hover:border-app-success/30 transition-all">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${att.status === 'PRESENT' ? 'bg-app-primary-light text-app-primary' : 'bg-rose-50 text-rose-600'}`}>
 <UserCheck size={20} />
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-3">
 <span className="font-black text-sm text-app-foreground tracking-tight">{name}</span>
 <Badge className={`${STATUS_BADGE[att.status] || 'bg-app-surface-2 text-app-muted-foreground'} border-none text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-tighter`}>{att.status}</Badge>
 </div>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-2">
 <MapPin size={10} className="text-app-muted-foreground" /> Primary Terminal · {att.date || '—'}
 </p>
 </div>
 <div className="flex items-center gap-8 text-right px-8">
 <div>
 <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">CHECK-IN</p>
 <p className="text-xs font-black text-app-foreground">{att.check_in || '—:—'}</p>
 </div>
 <div>
 <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">CHECK-OUT</p>
 <p className="text-xs font-black text-app-foreground">{att.check_out || '—:—'}</p>
 </div>
 </div>
 </div>
 )
 })
 ) : (
 employees.length === 0 ? <div className="text-sm font-bold text-app-muted-foreground py-20 text-center uppercase tracking-[0.2em] bg-app-surface rounded-[2rem] border border-dashed border-app-border">Workforce roster is empty</div> :
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {employees.map(emp => (
 <div key={emp.id} className="flex items-center gap-5 p-6 rounded-[2rem] bg-app-surface border border-app-border hover:shadow-lg transition-all group">
 <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-slate-50 text-app-primary flex items-center justify-center text-xl font-black shrink-0 shadow-inner group-hover:from-emerald-600 group-hover:to-emerald-700 group-hover:text-app-foreground transition-all">
 {emp.first_name?.[0]}{emp.last_name?.[0]}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-black text-app-foreground tracking-tight truncate">{emp.first_name} {emp.last_name}</h4>
 <Badge className={`${emp.status === 'ACTIVE' || !emp.status ? 'bg-app-primary-light text-app-primary' : 'bg-app-surface-2 text-app-muted-foreground'} border-none text-[8px] font-black px-2 py-0.5 rounded uppercase`}>
 {emp.status || 'ACTIVE'}
 </Badge>
 </div>
 <div className="flex flex-col gap-1">
 <div className="flex items-center gap-1.5 overflow-hidden">
 <Briefcase size={12} className="text-app-muted-foreground shrink-0" />
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest truncate">{emp.position || 'Specialist'}</span>
 </div>
 <div className="flex items-center gap-1.5 overflow-hidden">
 <Building2 size={12} className="text-app-muted-foreground shrink-0" />
 <span className="text-[10px] font-black text-app-primary uppercase tracking-tighter truncate">{emp.department?.name || 'GEN-OPS'}</span>
 </div>
 </div>
 </div>
 <div className="flex flex-col gap-2">
 <button className="p-2 rounded-xl bg-app-background text-app-muted-foreground hover:bg-app-primary-light hover:text-app-primary transition-all">
 <Mail size={16} />
 </button>
 <button className="p-2 rounded-xl bg-app-background text-app-muted-foreground hover:bg-app-primary-light hover:text-app-primary transition-all">
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
