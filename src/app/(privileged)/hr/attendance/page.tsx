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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-2xl">
                            <Fingerprint size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Tracking</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        Atten<span className="text-emerald-600">dance</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Real-time employee check-in/check-out tracking. Monitor presence across shifts and calculate working hours automatically.
                    </p>
                </div>

                <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-emerald-900/5 border border-gray-50">
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{attendance.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total Records</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-emerald-600 tracking-tighter mb-1">{todayRecords.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Today</div>
                    </div>
                    <div className="text-center px-8">
                        <div className="text-5xl font-black text-amber-600 tracking-tighter mb-1">{checkedIn}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">On-site Now</div>
                    </div>
                </div>
            </div>

            <AttendanceClient attendance={attendance} employees={employees} shifts={shifts} />
        </div>
    );
}
