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
 try { return await erpFetch('erp/users/') } catch { return [] }
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
 <div className="app-page space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <ClipboardList size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Workspace</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Checklist <span className="text-app-primary">Manager</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-warning/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-warning tracking-tighter mb-1">{pending}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-warning transition-colors">Active</div>
 </div>
 <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
 <ClipboardCheck size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-success/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-primary tracking-tighter mb-1">{completed}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Done</div>
 </div>
 <div className="absolute top-4 right-4 text-app-success group-hover:text-app-success transition-colors">
 <ListChecks size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-primary/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-primary tracking-tighter mb-1">{totalPoints}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Points</div>
 </div>
 <div className="absolute top-4 right-4 text-app-primary group-hover:text-app-primary transition-colors">
 <Award size={24} />
 </div>
 </div>
 </div>

 <ChecklistsClient checklists={arr} templates={templArr} users={Array.isArray(users) ? users : []} />
 </div>
 );
}
