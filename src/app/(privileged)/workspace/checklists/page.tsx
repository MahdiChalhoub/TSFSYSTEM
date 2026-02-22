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
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <ListChecks size={28} className="text-white" />
                        </div>
                        Check<span className="text-emerald-600">lists</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
                        Workspace &bull; Compliance Hub
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-amber-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-amber-600 tracking-tighter mb-1">{pending}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">Active</div>
                    </div>
                    <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
                        <ClipboardCheck size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-emerald-600 tracking-tighter mb-1">{completed}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Done</div>
                    </div>
                    <div className="absolute top-4 right-4 text-emerald-100 group-hover:text-emerald-200 transition-colors">
                        <ListChecks size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-indigo-600 tracking-tighter mb-1">{totalPoints}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Points</div>
                    </div>
                    <div className="absolute top-4 right-4 text-indigo-100 group-hover:text-indigo-200 transition-colors">
                        <Award size={24} />
                    </div>
                </div>
            </div>

            <ChecklistsClient checklists={arr} templates={templArr} users={Array.isArray(users) ? users : []} />
        </div>
    );
}
