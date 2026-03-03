/** HR Data Center — Shifts */
import { erpFetch } from "@/lib/erp-api";
import { Clock, Sun, Moon, Sunset } from "lucide-react";
import ShiftsClient from "./client";

export const dynamic = 'force-dynamic';

async function getShifts() {
 try { return await erpFetch('shifts/') } catch { return [] }
}

export default async function ShiftsPage() {
 const shifts = await getShifts();

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
 <div className="space-y-4">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-app-foreground shadow-2xl">
 <Clock size={24} />
 </div>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Scheduling</span>
 </div>
 <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
 Shift <span className="text-app-warning">Manager</span>
 </h1>
 <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
 Define work shifts with start/end times and break durations. Assign shifts to employees for workforce scheduling.
 </p>
 </div>

 <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-amber-900/5 border border-app-border">
 <div className="text-center px-8 border-r border-app-border">
 <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{shifts.length}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Shifts</div>
 </div>
 <div className="text-center px-8 border-r border-app-border">
 <div className="text-5xl font-black text-app-warning tracking-tighter mb-1">
 {shifts.filter((s: any) => s.shift_type === 'MORNING' || s.name?.toLowerCase().includes('morning')).length}
 </div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Morning</div>
 </div>
 <div className="text-center px-8">
 <div className="text-5xl font-black text-app-primary tracking-tighter mb-1">
 {shifts.filter((s: any) => s.shift_type === 'NIGHT' || s.name?.toLowerCase().includes('night')).length}
 </div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Night</div>
 </div>
 </div>
 </div>

 <ShiftsClient shifts={shifts} />
 </div>
 );
}
