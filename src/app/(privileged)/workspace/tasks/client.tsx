'use client';
import { useState, useTransition } from 'react';
import { Plus, Search, Filter, Play, CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronRight, Clock, AlertTriangle, ArrowUpDown, Calendar, Star } from 'lucide-react';
interface Task {
 id: number;
 title: string;
 status: string;
 priority: string;
 source: string;
 category?: number;
 category_name?: string;
 assigned_to?: number;
 assigned_to_name?: string;
 points: number;
 due_date?: string;
 is_overdue?: boolean;
 subtask_count: number;
 related_object_label?: string;
 created_at: string;
}
interface Props {
 tasks: Task[];
 categories: { id: number; name: string; color: string }[];
 users: { id: number; email: string; username: string }[];
}
const PRIORITY_COLORS: Record<string, string> = {
 URGENT: 'bg-app-error-bg text-app-error border-app-error',
 HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
 MEDIUM: 'bg-sky-100 text-sky-700 border-sky-200',
 LOW: 'bg-app-surface-2 text-app-muted-foreground border-app-border',
};
const STATUS_COLORS: Record<string, string> = {
 PENDING: 'bg-app-warning-bg text-app-warning',
 IN_PROGRESS: 'bg-sky-50 text-sky-700',
 AWAITING_RESPONSE: 'bg-purple-50 text-purple-700',
 COMPLETED: 'bg-app-primary-light text-app-success',
 CANCELLED: 'bg-app-background text-app-muted-foreground',
 OVERDUE: 'bg-app-error-bg text-app-error',
};
const STATUS_ICONS: Record<string, any> = {
 PENDING: Clock,
 IN_PROGRESS: Play,
 COMPLETED: CheckCircle2,
 CANCELLED: XCircle,
 OVERDUE: AlertTriangle,
};
export default function TasksClient({ tasks: initialTasks, categories, users }: Props) {
 const [tasks, setTasks] = useState(initialTasks);
 const [search, setSearch] = useState('');
 const [filterStatus, setFilterStatus] = useState('ALL');
 const [filterPriority, setFilterPriority] = useState('ALL');
 const [showCreate, setShowCreate] = useState(false);
 const [isPending, startTransition] = useTransition();
 // Form state
 const [newTitle, setNewTitle] = useState('');
 const [newDescription, setNewDescription] = useState('');
 const [newPriority, setNewPriority] = useState('MEDIUM');
 const [newCategory, setNewCategory] = useState('');
 const [newAssignee, setNewAssignee] = useState('');
 const [newDueDate, setNewDueDate] = useState('');
 const [newPoints, setNewPoints] = useState('1');
 const filtered = tasks.filter(t => {
 if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
 if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
 if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
 return true;
 });
 async function handleCreate() {
 if (!newTitle.trim()) return;
 const { createTask } = await import('@/app/actions/workspace');
 const data: Record<string, unknown> = {
 title: newTitle,
 description: newDescription,
 priority: newPriority,
 points: parseInt(newPoints) || 1,
 };
 if (newCategory) data.category = parseInt(newCategory);
 if (newAssignee) data.assigned_to = parseInt(newAssignee);
 if (newDueDate) data.due_date = new Date(newDueDate).toISOString();
 const result = await createTask(data);
 if (result?.id) {
 setTasks(prev => [result, ...prev]);
 setShowCreate(false);
 setNewTitle(''); setNewDescription(''); setNewPriority('MEDIUM'); setNewCategory(''); setNewAssignee(''); setNewDueDate(''); setNewPoints('1');
 }
 }
 async function handleAction(taskId: number, action: 'start' | 'complete' | 'cancel') {
 const mod = await import('@/app/actions/workspace');
 const fn = action === 'start' ? mod.startTask : action === 'complete' ? mod.completeTask : mod.cancelTask;
 await fn(taskId);
 setTasks(prev => prev.map(t => t.id === taskId ? {
 ...t,
 status: action === 'start' ? 'IN_PROGRESS' : action === 'complete' ? 'COMPLETED' : 'CANCELLED'
 } : t));
 }
 return (
 <div className="space-y-6">
 {/* Toolbar */}
 <div className="flex flex-wrap items-center gap-4 bg-app-surface p-4 rounded-3xl shadow-lg shadow-app-border/20 border border-app-border">
 <div className="relative flex-1 min-w-[200px]">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input
 type="text" placeholder="Search tasks..."
 value={search} onChange={e => setSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 bg-app-background rounded-2xl border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
 />
 </div>
 <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
 className="px-4 py-2.5 bg-app-background rounded-2xl border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-app-primary">
 <option value="ALL">All Status</option>
 <option value="PENDING">Pending</option>
 <option value="IN_PROGRESS">In Progress</option>
 <option value="COMPLETED">Completed</option>
 <option value="OVERDUE">Overdue</option>
 <option value="CANCELLED">Cancelled</option>
 </select>
 <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
 className="px-4 py-2.5 bg-app-background rounded-2xl border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-app-primary">
 <option value="ALL">All Priority</option>
 <option value="URGENT">Urgent</option>
 <option value="HIGH">High</option>
 <option value="MEDIUM">Medium</option>
 <option value="LOW">Low</option>
 </select>
 <button onClick={() => setShowCreate(true)}
 className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-app-foreground text-sm font-bold rounded-2xl hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center gap-2">
 <Plus size={16} /> New Task
 </button>
 </div>
 {/* Create Task Form */}
 {showCreate && (
 <div className="bg-app-surface p-8 rounded-3xl shadow-2xl shadow-indigo-100 border border-indigo-50 space-y-4 animate-in slide-in-from-top duration-300">
 <h3 className="text-lg font-bold text-app-foreground">Create New Task</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <input placeholder="Task title *" value={newTitle} onChange={e => setNewTitle(e.target.value)}
 className="col-span-full px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-app-primary" />
 <textarea placeholder="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3}
 className="col-span-full px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-app-primary resize-none" />
 <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
 className="px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm">
 <option value="LOW">Low Priority</option>
 <option value="MEDIUM">Medium Priority</option>
 <option value="HIGH">High Priority</option>
 <option value="URGENT">🔴 Urgent</option>
 </select>
 <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
 className="px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm">
 <option value="">No Category</option>
 {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
 className="px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm">
 <option value="">Assign to...</option>
 {users.map((u: any) => <option key={u.id} value={u.id}>{u.email || u.username}</option>)}
 </select>
 <input type="datetime-local" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
 className="px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm" />
 <input type="number" min="1" placeholder="Points" value={newPoints} onChange={e => setNewPoints(e.target.value)}
 className="px-4 py-3 bg-app-background rounded-2xl border border-app-border text-sm" />
 </div>
 <div className="flex gap-3 justify-end">
 <button onClick={() => setShowCreate(false)} className="px-6 py-2 text-sm text-app-muted-foreground hover:text-app-muted-foreground font-medium">Cancel</button>
 <button onClick={() => startTransition(handleCreate)}
 className="px-6 py-2 bg-app-primary text-app-foreground text-sm font-bold rounded-2xl hover:bg-app-primary transition-all">
 {isPending ? 'Creating...' : 'Create Task'}
 </button>
 </div>
 </div>
 )}
 {/* Tasks List */}
 <div className="space-y-3">
 {filtered.length === 0 ? (
 <div className="text-center py-20 bg-app-surface rounded-3xl border border-app-border">
 <ClipboardList size={48} className="mx-auto text-app-muted-foreground mb-4" />
 <p className="text-app-muted-foreground font-medium text-lg">No tasks found</p>
 <p className="text-app-muted-foreground text-sm mt-1">Create a new task or adjust your filters</p>
 </div>
 ) : filtered.map(task => {
 const StatusIcon = STATUS_ICONS[task.status] || Clock;
 return (
 <div key={task.id}
 className="group bg-app-surface rounded-2xl border border-app-border p-5 hover:shadow-lg hover:shadow-app-border/20 transition-all duration-300 flex items-center gap-4">
 {/* Status Icon */}
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STATUS_COLORS[task.status] || 'bg-app-background'}`}>
 <StatusIcon size={18} />
 </div>
 {/* Main Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-bold text-app-foreground truncate">{task.title}</h3>
 {task.subtask_count > 0 && (
 <span className="text-xs text-app-muted-foreground bg-app-background px-2 py-0.5 rounded-full">{task.subtask_count} sub</span>
 )}
 </div>
 <div className="flex items-center gap-3 text-xs text-app-muted-foreground">
 {task.category_name && (
 <span className="bg-app-background px-2 py-0.5 rounded-full">{task.category_name}</span>
 )}
 {task.assigned_to_name && (
 <span className="flex items-center gap-1">👤 {task.assigned_to_name}</span>
 )}
 {task.related_object_label && (
 <span className="text-app-primary">🔗 {task.related_object_label}</span>
 )}
 {task.due_date && (
 <span className={`flex items-center gap-1 ${task.is_overdue ? 'text-app-error font-bold' : ''}`}>
 <Calendar size={12} />
 {new Date(task.due_date).toLocaleDateString()}
 </span>
 )}
 </div>
 </div>
 {/* Points */}
 <div className="flex items-center gap-1 text-app-warning bg-app-warning-bg px-3 py-1.5 rounded-xl shrink-0">
 <Star size={14} /> <span className="text-sm font-bold">{task.points}</span>
 </div>
 {/* Priority Badge */}
 <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 ${PRIORITY_COLORS[task.priority] || ''}`}>
 {task.priority}
 </span>
 {/* Actions */}
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
 {task.status === 'PENDING' && (
 <button onClick={() => startTransition(() => handleAction(task.id, 'start'))}
 className="p-2 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors" title="Start">
 <Play size={14} />
 </button>
 )}
 {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
 <button onClick={() => startTransition(() => handleAction(task.id, 'complete'))}
 className="p-2 rounded-xl bg-app-primary-light text-app-primary hover:bg-app-primary-light transition-colors" title="Complete">
 <CheckCircle2 size={14} />
 </button>
 )}
 {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
 <button onClick={() => startTransition(() => handleAction(task.id, 'cancel'))}
 className="p-2 rounded-xl bg-app-error-bg text-app-error hover:bg-app-error-bg transition-colors" title="Cancel">
 <XCircle size={14} />
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 <p className="text-center text-xs text-app-muted-foreground font-medium">{filtered.length} of {tasks.length} tasks</p>
 </div>
 );
}
function ClipboardList(props: any) {
 return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>;
}
