/** HR Data Center — Attendance Tracker */
import { erpFetch } from "@/lib/erp-api";
import { Fingerprint, UserCheck, Clock } from "lucide-react";
import AttendanceClient from "./client";

export const dynamic = 'force-dynamic';

async function getAttendance() {
 try { return await erpFetch('attendance/') } catch { return [] }
}

async function getEmployees() {
 try { return await erpFetch('employees/') } catch { return [] }
}

async function getShifts() {
 try { return await erpFetch('shifts/') } catch { return [] }
}

export default async function AttendancePage() {
 const [attendance, employees, shifts] = await Promise.all([getAttendance(), getEmployees(), getShifts()]);

 const today = new Date().toISOString().split('T')[0];
 const todayRecords = attendance.filter((a: any) => a.date === today || a.created_at?.startsWith(today));
 const checkedIn = todayRecords.filter((a: any) => a.check_in && !a.check_out).length;

 return (
 <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-white">
 <Fingerprint size={28} />
 </div>
 Atten<span className="text-emerald-600">dance</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Real-time Pulse: Workforce Presence Tracking</p>
 </div>
 {/* KPI Pulse */}
 <div className="flex gap-4">
 <div className="bg-app-surface p-6 rounded-[2rem] shadow-sm border border-app-border flex items-center gap-5 min-w-[200px]">
 <div className="w-12 h-12 rounded-2xl bg-app-bg text-app-text-faint flex items-center justify-center">
 <Clock size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mt-1 leading-none mb-1">Total Logs</p>
 <h2 className="text-2xl font-black text-app-text tracking-tighter">{attendance.length}</h2>
 </div>
 </div>
 <div className="bg-app-surface p-6 rounded-[2rem] shadow-sm border border-emerald-100 flex items-center gap-5 min-w-[200px]">
 <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
 <UserCheck size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 leading-none mb-1">On-Site Now</p>
 <h2 className="text-2xl font-black text-emerald-600 tracking-tighter">{checkedIn}</h2>
 </div>
 </div>
 </div>
 </header>

 <AttendanceClient attendance={attendance} employees={employees} shifts={shifts} />
 </div>
 );
}
