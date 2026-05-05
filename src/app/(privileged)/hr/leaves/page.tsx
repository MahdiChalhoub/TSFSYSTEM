/** HR Data Center — Leave Requests */
import { erpFetch } from "@/lib/erp-api";
import { CalendarOff, Check, X, Clock } from "lucide-react";
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-app-primary flex items-center justify-center text-white shadow-2xl">
                            <CalendarOff size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Time Off</span>
                    </div>
                    <h1>
                        Leave <span className="text-app-error">Requests</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Manage employee leave applications — annual, sick, maternity, and more. Review, approve, or reject requests.
                    </p>
                </div>

                <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-rose-900/5 border border-app-border">
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{leaves.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-warning tracking-tighter mb-1">{pending}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Pending</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-success tracking-tighter mb-1">{approved}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Approved</div>
                    </div>
                    <div className="text-center px-8">
                        <div className="text-5xl font-black text-app-error tracking-tighter mb-1">{rejected}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Rejected</div>
                    </div>
                </div>
            </div>

            <LeavesClient leaves={leaves} employees={employees} />
        </div>
    );
}
