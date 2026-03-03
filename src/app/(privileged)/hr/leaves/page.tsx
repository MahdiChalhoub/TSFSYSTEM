/** HR Data Center — Leave Requests */
import { erpFetch } from "@/lib/erp-api";
import { CalendarOff, Check, X, Clock, CalendarDays, CheckCircle } from "lucide-react";
import LeavesClient from "./client";

export const dynamic = 'force-dynamic';

async function getLeaves() {
 try { return await erpFetch('leaves/') } catch { return [] }
}

async function getEmployees() {
 try { return await erpFetch('employees/') } catch { return [] }
}

export default async function LeavesPage() {
 const [leaves, employees] = await Promise.all([getLeaves(), getEmployees()]);

 const pending = leaves.filter((l: any) => l.status === 'PENDING').length;
 const approved = leaves.filter((l: any) => l.status === 'APPROVED').length;
 const rejected = leaves.filter((l: any) => l.status === 'REJECTED').length;

 return (
 <div className="app-page p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <CalendarDays size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Human Resources</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Leave <span className="text-app-primary">Management</span>
          </h1>
        </div>
      </div>
    </header>

 <LeavesClient leaves={leaves} employees={employees} />
 </div>
 );
}
