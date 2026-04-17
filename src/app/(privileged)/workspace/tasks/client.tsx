'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import {
    Plus, Search, Play, CheckCircle2, XCircle, Clock, AlertTriangle,
    Calendar, Star, ClipboardList, Loader2, X, Maximize2, Minimize2,
} from 'lucide-react';

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

interface Dashboard {
    total_assigned?: number;
    pending?: number;
    in_progress?: number;
    completed?: number;
    overdue?: number;
    assigned_by_me?: number;
}

interface Props {
    tasks: Task[];
    categories: { id: number; name: string; color: string }[];
    users: { id: number; email: string; username: string }[];
    dashboard: Dashboard;
}

const STATUS_ICONS: Record<string, any> = {
    PENDING: Clock,
    IN_PROGRESS: Play,
    COMPLETED: CheckCircle2,
    CANCELLED: XCircle,
    OVERDUE: AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
    PENDING: 'var(--app-warning, #f59e0b)',
    IN_PROGRESS: 'var(--app-info, #3b82f6)',
    AWAITING_RESPONSE: '#8b5cf6',
    COMPLETED: 'var(--app-success, #22c55e)',
    CANCELLED: 'var(--app-muted-foreground)',
    OVERDUE: 'var(--app-error, #ef4444)',
};

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
};

const inputCls =
    'w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all';

const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block';

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export default function TasksClient({ tasks: initialTasks, categories, users, dashboard }: Props) {
    const [tasks, setTasks] = useState(initialTasks);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<StatusFilter | null>(null);
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [showCreate, setShowCreate] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [focusMode, setFocusMode] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newPriority, setNewPriority] = useState('MEDIUM');
    const [newCategory, setNewCategory] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [newPoints, setNewPoints] = useState('1');

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const filtered = tasks.filter(t => {
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (activeFilter && activeFilter !== 'ALL' && t.status !== activeFilter) return false;
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
            setNewTitle(''); setNewDescription(''); setNewPriority('MEDIUM');
            setNewCategory(''); setNewAssignee(''); setNewDueDate(''); setNewPoints('1');
        }
    }

    async function handleAction(taskId: number, action: 'start' | 'complete' | 'cancel') {
        const mod = await import('@/app/actions/workspace');
        const fn = action === 'start' ? mod.startTask : action === 'complete' ? mod.completeTask : mod.cancelTask;
        await fn(taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t,
            status: action === 'start' ? 'IN_PROGRESS' : action === 'complete' ? 'COMPLETED' : 'CANCELLED',
        } : t));
    }

    const kpis: { label: string; value: number; color: string; icon: React.ReactNode; filterKey: StatusFilter | null }[] = [
        { label: 'Assigned',    value: dashboard?.total_assigned ?? 0, color: 'var(--app-primary)',          icon: <ClipboardList size={14} />, filterKey: 'ALL' },
        { label: 'Pending',     value: dashboard?.pending ?? 0,        color: 'var(--app-warning, #f59e0b)', icon: <Clock size={14} />,         filterKey: 'PENDING' },
        { label: 'In Progress', value: dashboard?.in_progress ?? 0,    color: 'var(--app-info, #3b82f6)',    icon: <Play size={14} />,          filterKey: 'IN_PROGRESS' },
        { label: 'Done',        value: dashboard?.completed ?? 0,      color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} />,  filterKey: 'COMPLETED' },
        { label: 'Overdue',     value: dashboard?.overdue ?? 0,        color: 'var(--app-error, #ef4444)',   icon: <AlertTriangle size={14} />, filterKey: 'OVERDUE' },
    ];

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            {/* ── Header ────────────────────────────────────────────── */}
            {focusMode ? (
                <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <ClipboardList size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Task Board</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{tasks.length}</span>
                    </div>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search… (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-1.5 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ClipboardList size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Task Board</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {dashboard?.total_assigned ?? 0} Tasks · {dashboard?.pending ?? 0} Pending · {dashboard?.overdue ?? 0} Overdue
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                        >
                            <Plus size={14} />
                            <span className="hidden sm:inline">New Task</span>
                        </button>
                        <button
                            onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            title="Focus Mode (Ctrl+Q)"
                        >
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            )}

            {!focusMode && (
                <>
                    {/* ── KPI Strip (filter-toggle) ────────────────────── */}
                    <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}
                        className="flex-shrink-0 mb-3"
                    >
                        {kpis.map(k => {
                            const isActive = !!k.filterKey && activeFilter === k.filterKey;
                            return (
                                <button
                                    key={k.label}
                                    onClick={() => {
                                        if (!k.filterKey) return;
                                        setActiveFilter(prev => prev === k.filterKey ? null : k.filterKey);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${isActive ? 'ring-2 shadow-md scale-[1.02]' : ''}`}
                                    style={{
                                        background: isActive
                                            ? `color-mix(in srgb, ${k.color} 15%, var(--app-surface))`
                                            : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: `1px solid color-mix(in srgb, ${isActive ? k.color : 'var(--app-border)'} 50%, transparent)`,
                                    }}
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}
                                    >
                                        {k.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {activeFilter && activeFilter !== 'ALL' && (
                        <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                            <span
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                    color: 'var(--app-primary)',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                }}
                            >
                                Status: {activeFilter}
                                <button onClick={() => setActiveFilter(null)} className="hover:opacity-70">✕</button>
                            </span>
                        </div>
                    )}

                    {/* ── Search + Priority Filter ─────────────────────── */}
                    <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search tasks… (Ctrl+K)"
                                className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                            />
                        </div>
                        <select
                            value={filterPriority}
                            onChange={e => setFilterPriority(e.target.value)}
                            className="text-[12px] font-bold px-3 py-2 bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10"
                        >
                            <option value="ALL">All Priority</option>
                            <option value="URGENT">Urgent</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                </>
            )}

            {/* ── Inline Create Form ───────────────────────────────── */}
            {showCreate && (
                <div
                    className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderColor: 'var(--app-border)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">New Task</h3>
                        <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
                            <X size={14} className="text-app-muted-foreground" />
                        </button>
                    </div>
                    <form
                        onSubmit={e => { e.preventDefault(); startTransition(handleCreate); }}
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}
                    >
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className={labelCls}>Title *</label>
                            <input
                                className={inputCls}
                                placeholder="Task title"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className={labelCls}>Description</label>
                            <textarea
                                className={`${inputCls} resize-none`}
                                rows={2}
                                placeholder="Description"
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Priority</label>
                            <select className={inputCls} value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Category</label>
                            <select className={inputCls} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                                <option value="">No category</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Assignee</label>
                            <select className={inputCls} value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
                                <option value="">Unassigned</option>
                                {users.map((u: any) => <option key={u.id} value={u.id}>{u.email || u.username}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Due</label>
                            <input type="datetime-local" className={inputCls} value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Points</label>
                            <input type="number" min={1} className={inputCls} value={newPoints} onChange={e => setNewPoints(e.target.value)} />
                        </div>
                        <div className="flex gap-2 justify-end" style={{ gridColumn: '1 / -1' }}>
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                            >
                                {isPending ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Task List Container ─────────────────────────────── */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <ClipboardList size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No tasks found</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Create a new task or adjust your filters.
                            </p>
                        </div>
                    ) : (
                        filtered.map(task => {
                            const StatusIcon = STATUS_ICONS[task.status] ?? Clock;
                            const statusColor = STATUS_COLOR[task.status] ?? 'var(--app-muted-foreground)';
                            const priorityColor = PRIORITY_COLOR[task.priority] ?? 'var(--app-muted-foreground)';
                            return (
                                <div
                                    key={task.id}
                                    className="group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/60 py-2 md:py-2.5"
                                    style={{
                                        paddingLeft: '12px',
                                        paddingRight: '12px',
                                        borderLeft: `3px solid ${statusColor}`,
                                    }}
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}
                                    >
                                        <StatusIcon size={13} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-[13px] font-bold text-app-foreground">{task.title}</span>
                                            {task.subtask_count > 0 && (
                                                <span
                                                    className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                                    style={{
                                                        background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                                        color: 'var(--app-muted-foreground)',
                                                    }}
                                                >
                                                    {task.subtask_count} sub
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-medium text-app-muted-foreground truncate">
                                            {task.category_name && <span>{task.category_name}</span>}
                                            {task.assigned_to_name && <span>· {task.assigned_to_name}</span>}
                                            {task.related_object_label && <span style={{ color: 'var(--app-primary)' }}>· {task.related_object_label}</span>}
                                            {task.due_date && (
                                                <span
                                                    className="flex items-center gap-0.5"
                                                    style={task.is_overdue ? { color: 'var(--app-error, #ef4444)', fontWeight: 700 } : undefined}
                                                >
                                                    <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        className="hidden md:flex items-center gap-1 flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                            color: 'var(--app-warning, #f59e0b)',
                                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                        }}
                                    >
                                        <Star size={10} /> {task.points}
                                    </div>

                                    <span
                                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{
                                            background: `color-mix(in srgb, ${priorityColor} 10%, transparent)`,
                                            color: priorityColor,
                                            border: `1px solid color-mix(in srgb, ${priorityColor} 25%, transparent)`,
                                        }}
                                    >
                                        {task.priority}
                                    </span>

                                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {task.status === 'PENDING' && (
                                            <button
                                                onClick={() => startTransition(() => handleAction(task.id, 'start'))}
                                                className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                                                title="Start"
                                                style={{ color: 'var(--app-info, #3b82f6)' }}
                                            >
                                                <Play size={12} />
                                            </button>
                                        )}
                                        {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                                            <button
                                                onClick={() => startTransition(() => handleAction(task.id, 'complete'))}
                                                className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                                                title="Complete"
                                                style={{ color: 'var(--app-success, #22c55e)' }}
                                            >
                                                <CheckCircle2 size={12} />
                                            </button>
                                        )}
                                        {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                                            <button
                                                onClick={() => startTransition(() => handleAction(task.id, 'cancel'))}
                                                className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                                                title="Cancel"
                                                style={{ color: 'var(--app-error, #ef4444)' }}
                                            >
                                                <XCircle size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <p className="flex-shrink-0 text-center text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-2">
                {filtered.length} / {tasks.length} Tasks
            </p>
        </div>
    );
}
