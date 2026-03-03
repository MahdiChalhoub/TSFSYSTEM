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
 try { return await erpFetch('erp/users/') } catch { return [] }
}

export default async function TasksPage() {
 const [tasks, categories, dashboard, users] = await Promise.all([
 getTasks(), getCategories(), getDashboard(), getUsers(),
 ]);
 const arr = Array.isArray(tasks) ? tasks : (tasks?.results ?? []);

 return (
 <div className="app-page space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <CheckSquare size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Workspace</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Task <span className="text-app-primary">Manager</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-primary/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{dashboard?.total_assigned ?? 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Assigned</div>
 </div>
 <div className="absolute top-4 right-4 text-app-primary group-hover:text-app-primary transition-colors">
 <ClipboardList size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-warning/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-warning tracking-tighter mb-1">{dashboard?.pending ?? 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-warning transition-colors">Pending</div>
 </div>
 <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
 <Clock size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-sky-100 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-sky-600 tracking-tighter mb-1">{dashboard?.in_progress ?? 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-sky-600 transition-colors">Active</div>
 </div>
 <div className="absolute top-4 right-4 text-sky-100 group-hover:text-sky-200 transition-colors">
 <ArrowUpDown size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-success/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-primary tracking-tighter mb-1">{dashboard?.completed ?? 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Done</div>
 </div>
 <div className="absolute top-4 right-4 text-app-success group-hover:text-app-success transition-colors">
 <CheckCircle2 size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-error/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-error tracking-tighter mb-1">{dashboard?.overdue ?? 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-error transition-colors">Overdue</div>
 </div>
 <div className="absolute top-4 right-4 text-app-error group-hover:text-app-error transition-colors">
 <AlertTriangle size={24} />
 </div>
 </div>
 </div>

 <TasksClient tasks={arr} categories={Array.isArray(categories) ? categories : []} users={Array.isArray(users) ? users : []} />
 </div>
 );
}
