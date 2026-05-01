/** HR Data Center — Departments */
import { erpFetch } from "@/lib/erp-api";
import { Building2, GitBranch, Users } from "lucide-react";
import DepartmentsClient from "./client";

export const dynamic = 'force-dynamic';

async function getDepartments() {
    try { return await erpFetch('departments/') } catch { return [] }
}

async function getEmployees() {
    try { return await erpFetch('employees/') } catch { return [] }
}

export default async function DepartmentsPage() {
    const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);

    const active = departments.filter((d: any) => d.is_active !== false).length;
    const roots = departments.filter((d: any) => !d.parent).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-app-gradient-accent flex items-center justify-center text-white shadow-2xl">
                            <Building2 size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Organization</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        Depart<span className="text-violet-600">ments</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Hierarchical structure of your organization. Assign managers, build reporting chains, and organize your workforce.
                    </p>
                </div>

                <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-violet-900/5 border border-app-border">
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{departments.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-violet-600 tracking-tighter mb-1">{active}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active</div>
                    </div>
                    <div className="text-center px-8">
                        <div className="text-5xl font-black text-app-success tracking-tighter mb-1">{roots}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Root Depts</div>
                    </div>
                </div>
            </div>

            <DepartmentsClient departments={departments} employees={employees} />
        </div>
    );
}
