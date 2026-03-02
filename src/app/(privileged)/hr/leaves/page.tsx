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
        <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-white">
                            <CalendarDays size={28} />
                        </div>
                        Leave <span className="text-emerald-600">Requests</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Absence Governance & Approval Workflow</p>
                </div>
                {/* Approval Pulse */}
                <div className="flex gap-4">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 leading-none mb-1">Pending Auth</p>
                            <h2 className="text-2xl font-black text-amber-600 tracking-tighter">{pending}</h2>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 flex items-center gap-5 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 leading-none mb-1">Approved</p>
                            <h2 className="text-2xl font-black text-emerald-600 tracking-tighter">{approved}</h2>
                        </div>
                    </div>
                </div>
            </header>

            <LeavesClient leaves={leaves} employees={employees} />
        </div>
    );
}
