/** Workspace — Task Management Dashboard */
import { erpFetch } from "@/lib/erp-api";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, ArrowUpDown, Users2 } from "lucide-react";
import TasksClient from "./client";

export const dynamic = 'force-dynamic';

async function getTasks() {
    try { return await erpFetch('workspace/tasks/?root_only=true') } catch { return [] }
}

async function getCategories() {
    try { return await erpFetch('workspace/categories/') } catch { return [] }
}

async function getDashboard() {
    try { return await erpFetch('workspace/tasks/dashboard/') } catch { return { total_assigned: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, assigned_by_me: 0 } }
}

async function getUsers() {
    try { return await erpFetch('users/') } catch { return [] }
}

export default async function TasksPage() {
    const [tasks, categories, dashboard, users] = await Promise.all([
        getTasks(), getCategories(), getDashboard(), getUsers(),
    ]);
    const arr = Array.isArray(tasks) ? tasks : (tasks?.results ?? []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ClipboardList size={28} className="text-white" />
                        </div>
                        Task <span className="text-indigo-600">Board</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
                        Workspace &bull; Operations Hub
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-gray-900 tracking-tighter mb-1">{dashboard?.total_assigned ?? 0}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Assigned</div>
                    </div>
                    <div className="absolute top-4 right-4 text-indigo-100 group-hover:text-indigo-200 transition-colors">
                        <ClipboardList size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-amber-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-amber-600 tracking-tighter mb-1">{dashboard?.pending ?? 0}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">Pending</div>
                    </div>
                    <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
                        <Clock size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-sky-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-sky-600 tracking-tighter mb-1">{dashboard?.in_progress ?? 0}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-sky-600 transition-colors">Active</div>
                    </div>
                    <div className="absolute top-4 right-4 text-sky-100 group-hover:text-sky-200 transition-colors">
                        <ArrowUpDown size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-emerald-600 tracking-tighter mb-1">{dashboard?.completed ?? 0}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Done</div>
                    </div>
                    <div className="absolute top-4 right-4 text-emerald-100 group-hover:text-emerald-200 transition-colors">
                        <CheckCircle2 size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-red-100 transition-all duration-300">
                    <div className="relative z-10">
                        <div className="text-4xl font-black text-red-600 tracking-tighter mb-1">{dashboard?.overdue ?? 0}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-red-600 transition-colors">Overdue</div>
                    </div>
                    <div className="absolute top-4 right-4 text-red-100 group-hover:text-red-200 transition-colors">
                        <AlertTriangle size={24} />
                    </div>
                </div>
            </div>

            <TasksClient tasks={arr} categories={Array.isArray(categories) ? categories : []} users={Array.isArray(users) ? users : []} />
        </div>
    );
}
