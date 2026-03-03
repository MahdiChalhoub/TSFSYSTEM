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
 <div className="app-page p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Clock size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Human Resources</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Attendance <span className="text-app-primary">Tracker</span>
          </h1>
        </div>
      </div>
    </header>

 <AttendanceClient attendance={attendance} employees={employees} shifts={shifts} />
 </div>
 );
}
