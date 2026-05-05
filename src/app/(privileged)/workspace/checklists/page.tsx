/** Workspace — Checklists */
import { erpFetch } from "@/lib/erp-api";
import { ListChecks, ClipboardCheck, Calendar, Award } from "lucide-react";
import ChecklistsClient from "./client";

export const dynamic = 'force-dynamic';

async function getChecklists() {
    try { return await erpFetch('workspace/checklists/?mine=true') } catch { return [] }
}

async function getTemplates() {
    try { return await erpFetch('workspace/checklist-templates/') } catch { return [] }
}

async function getUsers() {
    try { return await erpFetch('users/') } catch { return [] }
}

export default async function ChecklistsPage() {
    const [checklists, templates, users] = await Promise.all([
        getChecklists(), getTemplates(), getUsers(),
    ]);
    const arr = Array.isArray(checklists) ? checklists : (checklists?.results ?? []);
    const templArr = Array.isArray(templates) ? templates : (templates?.results ?? []);

    const completed = arr.filter((c: any) => c.status === 'COMPLETED').length;
    const pending = arr.filter((c: any) => c.status === 'PENDING' || c.status === 'IN_PROGRESS').length;
    const totalPoints = arr.reduce((sum: number, c: any) => sum + (c.points_earned || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-app-primary flex items-center justify-center text-white shadow-2xl">
                            <ListChecks size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Workspace</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        Check<span className="text-app-success">lists</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Shift checklists, daily tasks, and compliance checks. Complete items to earn points and track performance.
                    </p>
                </div>

                <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-emerald-900/5 border border-app-border">
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-warning tracking-tighter mb-1">{pending}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-success tracking-tighter mb-1">{completed}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Done</div>
                    </div>
                    <div className="text-center px-8">
                        <div className="text-5xl font-black text-app-info tracking-tighter mb-1">{totalPoints}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Points</div>
                    </div>
                </div>
            </div>

            <ChecklistsClient checklists={arr} templates={templArr} users={Array.isArray(users) ? users : []} />
        </div>
    );
}
