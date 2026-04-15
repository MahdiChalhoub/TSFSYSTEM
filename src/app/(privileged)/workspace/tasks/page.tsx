/** Workspace — Task Management Dashboard */
import { erpFetch } from "@/lib/erp-api";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, ArrowUpDown, Users2 } from "lucide-react";
import TasksClient from "./client";

export const dynamic = 'force-dynamic';

async function getTasks() {
    try { return await erpFetch('workspace/tasks/?root_only=true') } catch { return [] }
}

async function getCategories() {
    try { return await erpFetch('workspace/task-categories/') } catch { return [] }
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-2xl">
                            <ClipboardList size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Workspace</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        Task<span className="text-indigo-600">Board</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Assign, track, and manage tasks across your organization. Monitor performance and stay on top of deadlines.
                    </p>
                </div>

                <div className="flex flex-wrap gap-6 bg-app-surface p-8 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                    <div className="text-center px-6 border-r border-app-border">
                        <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{dashboard?.total_assigned ?? 0}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Assigned</div>
                    </div>
                    <div className="text-center px-6 border-r border-app-border">
                        <div className="text-5xl font-black text-amber-500 tracking-tighter mb-1">{dashboard?.pending ?? 0}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Pending</div>
                    </div>
                    <div className="text-center px-6 border-r border-app-border">
                        <div className="text-5xl font-black text-sky-500 tracking-tighter mb-1">{dashboard?.in_progress ?? 0}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">In Progress</div>
                    </div>
                    <div className="text-center px-6 border-r border-app-border">
                        <div className="text-5xl font-black text-emerald-600 tracking-tighter mb-1">{dashboard?.completed ?? 0}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Done</div>
                    </div>
                    <div className="text-center px-6">
                        <div className="text-5xl font-black text-red-500 tracking-tighter mb-1">{dashboard?.overdue ?? 0}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Overdue</div>
                    </div>
                </div>
            </div>

            <TasksClient tasks={arr} categories={Array.isArray(categories) ? categories : []} users={Array.isArray(users) ? users : []} />
        </div>
    );
}
