'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import {
    Plus, Search, Play, CheckCircle2, Clock, AlertTriangle,
    ClipboardList, Loader2, Maximize2, Minimize2,
    FolderKanban, ChevronRight, Filter, Menu, Calendar,
} from 'lucide-react';

import type { Task, Category, UserItem, Dashboard, CategorySelection, StatusFilter } from './types';
import { getUserName } from './types';
import CategorySidebar from './CategorySidebar';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import CategoryManagementModal from './CategoryManagementModal';

/* ═══════════════════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
    tasks: Task[];
    categories: Category[];
    users: UserItem[];
    dashboard: Dashboard;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TasksClient({ tasks: initialTasks, categories: initialCategories, users, dashboard }: Props) {
    /* ── Core state ───────────────────────────────────────────────── */
    const [tasks, setTasks] = useState(initialTasks);
    const [categories, setCategories] = useState(initialCategories);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [focusMode, setFocusMode] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    /* ── Sidebar state ────────────────────────────────────────────── */
    const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>('all');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    /* ── Filter state ─────────────────────────────────────────────── */
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('list');

    /* ── Modal state ──────────────────────────────────────────────── */
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showCategoryManagement, setShowCategoryManagement] = useState(false);

    /* ── Keyboard shortcuts ───────────────────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    /* ── Reload from server ───────────────────────────────────────── */
    const reload = useCallback(async () => {
        try {
            const { getTasks, getTaskCategories } = await import('@/app/actions/workspace');
            const [newTasks, newCats] = await Promise.all([
                getTasks('root_only=true'),
                getTaskCategories(),
            ]);
            const arr = Array.isArray(newTasks) ? newTasks : (newTasks?.results ?? []);
            setTasks(arr);
            if (Array.isArray(newCats)) setCategories(newCats);
        } catch { /* silent */ }
    }, []);

    /* ── Sidebar handlers ─────────────────────────────────────────── */
    const handleCategoryClick = (catId: CategorySelection) => {
        setSelectedCategoryId(catId);
        setSelectedUserId(null);
        setShowMobileSidebar(false);
    };

    const handleUserClick = (catId: number, userId: number) => {
        setSelectedCategoryId(catId);
        setSelectedUserId(userId);
        setShowMobileSidebar(false);
    };

    const toggleCategoryExpanded = (catId: number) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            next.has(catId) ? next.delete(catId) : next.add(catId);
            return next;
        });
    };

    /* ── Filtering logic ──────────────────────────────────────────── */
    const getFilteredTasks = () => {
        let filtered = tasks;

        // Category
        if (selectedCategoryId === 'all') { /* show all */ }
        else if (selectedCategoryId === null) { filtered = filtered.filter(t => !t.category); }
        else { filtered = filtered.filter(t => t.category === selectedCategoryId); }

        // User
        if (selectedUserId) filtered = filtered.filter(t => t.assigned_to === selectedUserId);

        // Search
        if (search) filtered = filtered.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

        // Status
        if (filterStatus !== 'ALL') filtered = filtered.filter(t => t.status === filterStatus);

        // Priority
        if (filterPriority !== 'ALL') filtered = filtered.filter(t => t.priority === filterPriority);

        // Date range
        if (filterStartDate) filtered = filtered.filter(t => t.due_date && t.due_date >= filterStartDate);
        if (filterEndDate) filtered = filtered.filter(t => t.due_date && t.due_date <= filterEndDate);

        return filtered;
    };

    const filteredTasks = getFilteredTasks();
    const activeTasks = filteredTasks.filter(t => t.status !== 'COMPLETED');
    const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED');
    const hasActiveFilters = filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterStartDate || filterEndDate;

    /* ── Quick-complete toggle ─────────────────────────────────────── */
    function handleQuickComplete(taskId: number, currentStatus: string, e: React.MouseEvent) {
        e.stopPropagation();
        const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        startTransition(async () => {
            try {
                if (newStatus === 'COMPLETED') {
                    const { completeTask } = await import('@/app/actions/workspace');
                    await completeTask(taskId);
                } else {
                    const { updateTask } = await import('@/app/actions/workspace');
                    await updateTask(taskId, { status: 'PENDING' });
                }
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
            } catch { /* silent */ }
        });
    }

    /* ── Display helpers ───────────────────────────────────────────── */
    const getDisplayTitle = () => {
        if (selectedCategoryId === 'all') return 'All Tasks';
        if (selectedCategoryId === null) return 'Uncategorized Tasks';
        const cat = categories.find(c => c.id === selectedCategoryId);
        if (selectedUserId) {
            const user = users.find(u => u.id === selectedUserId);
            return `${cat?.name || 'Tasks'} — ${user ? getUserName(user) : 'Unknown'}`;
        }
        return cat?.name || 'Tasks';
    };

    const clearFilters = () => {
        setFilterStatus('ALL');
        setFilterPriority('ALL');
        setFilterStartDate('');
        setFilterEndDate('');
    };

    /* ═══════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════ */

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-shrink-0 mb-4">
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
                    <div className="flex items-center gap-0.5 p-0.5 rounded-xl border border-app-border"
                        style={{ background: 'color-mix(in srgb, var(--app-bg) 40%, transparent)' }}
                        title="Switch between list and card view">
                        <button onClick={() => setViewMode('list')}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{
                                background: viewMode === 'list' ? 'var(--app-primary)' : 'transparent',
                                color: viewMode === 'list' ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            List
                        </button>
                        <button onClick={() => setViewMode('card')}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{
                                background: viewMode === 'card' ? 'var(--app-primary)' : 'transparent',
                                color: viewMode === 'card' ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            Cards
                        </button>
                    </div>
                    <button onClick={() => setFocusMode(prev => !prev)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            title="Focus Mode (Ctrl+Q)">
                        {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>

            {/* ── KPI Strip ──────────────────────────────────────── */}
            {!focusMode && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}
                     className="flex-shrink-0 mb-4">
                    {[
                        { label: 'Assigned', value: dashboard?.total_assigned ?? 0, color: 'var(--app-primary)', icon: <ClipboardList size={14} /> },
                        { label: 'Pending', value: dashboard?.pending ?? 0, color: 'var(--app-warning, #f59e0b)', icon: <Clock size={14} /> },
                        { label: 'In Progress', value: dashboard?.in_progress ?? 0, color: 'var(--app-info, #3b82f6)', icon: <Play size={14} /> },
                        { label: 'Done', value: dashboard?.completed ?? 0, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} /> },
                        { label: 'Overdue', value: dashboard?.overdue ?? 0, color: 'var(--app-error, #ef4444)', icon: <AlertTriangle size={14} /> },
                    ].map(k => (
                        <div key={k.label}
                             className="flex items-center gap-2 px-3 py-2 rounded-xl"
                             style={{
                                 background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                 border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                             }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                 style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                                {k.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Main Layout: Sidebar + Tasks ───────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
                {/* Mobile category toggle */}
                <button onClick={() => setShowMobileSidebar(true)}
                        className="lg:hidden flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-colors"
                        style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                    <Menu size={15} style={{ color: 'var(--app-primary)' }} />
                    <span className="text-[12px] font-bold">Categories</span>
                </button>

                {/* Mobile sidebar overlay */}
                {showMobileSidebar && (
                    <div className="lg:hidden fixed inset-0 z-30"
                         style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(6px)' }}
                         onClick={() => setShowMobileSidebar(false)}>
                        <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw]" onClick={e => e.stopPropagation()}>
                            <CategorySidebar
                                tasks={tasks} categories={categories} users={users}
                                selectedCategoryId={selectedCategoryId} selectedUserId={selectedUserId}
                                expandedCategories={expandedCategories}
                                onSelectCategory={handleCategoryClick} onSelectUser={handleUserClick}
                                onToggleExpanded={toggleCategoryExpanded}
                                onManageCategories={() => setShowCategoryManagement(true)}
                                onCloseMobile={() => setShowMobileSidebar(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Desktop sidebar */}
                <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
                    <div className="sticky top-24">
                        <CategorySidebar
                            tasks={tasks} categories={categories} users={users}
                            selectedCategoryId={selectedCategoryId} selectedUserId={selectedUserId}
                            expandedCategories={expandedCategories}
                            onSelectCategory={handleCategoryClick} onSelectUser={handleUserClick}
                            onToggleExpanded={toggleCategoryExpanded}
                            onManageCategories={() => setShowCategoryManagement(true)}
                        />
                    </div>
                </div>

                {/* ── Tasks Area ─────────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {/* Tasks header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                        <div>
                            <h2 className="text-base sm:text-lg font-black" style={{ color: 'var(--app-foreground)' }}>
                                {getDisplayTitle()}
                            </h2>
                            <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {activeTasks.length} active, {completedTasks.length} completed
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 sm:flex-none sm:w-48">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                                <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                                       placeholder="Search… (⌘K)"
                                       className="w-full pl-8 pr-3 py-1.5 text-[12px] font-bold rounded-xl outline-none transition-all"
                                       style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }} />
                            </div>

                            {/* Filter button */}
                            <button onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all"
                                    style={{
                                        background: hasActiveFilters ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                                        borderColor: hasActiveFilters ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'var(--app-border)',
                                        color: hasActiveFilters ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                    }}>
                                <Filter size={13} />
                                <span className="hidden sm:inline">Filter</span>
                                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />}
                            </button>

                            {/* New Task */}
                            <button onClick={() => setShowCreateTask(true)}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={14} />
                                <span className="hidden sm:inline">New Task</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter panel */}
                    {showFilters && (
                        <div className="mb-3 p-3 rounded-xl border"
                             style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Status</label>
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)}
                                            className="w-full px-2.5 py-2 text-[12px] font-bold rounded-xl outline-none"
                                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="ALL">All Status</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="COMPLETED">Completed</option>
                                        <option value="CANCELLED">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Priority</label>
                                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                                            className="w-full px-2.5 py-2 text-[12px] font-bold rounded-xl outline-none"
                                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="ALL">All Priorities</option>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        <Calendar size={9} /> Start Date
                                    </label>
                                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
                                           className="w-full px-2.5 py-2 text-[12px] font-bold rounded-xl outline-none"
                                           style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        <Calendar size={9} /> End Date
                                    </label>
                                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
                                           className="w-full px-2.5 py-2 text-[12px] font-bold rounded-xl outline-none"
                                           style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                            </div>
                            {hasActiveFilters && (
                                <div className="mt-2 flex justify-end">
                                    <button onClick={clearFilters} className="text-[11px] font-bold" style={{ color: 'var(--app-primary)' }}>
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Task list container */}
                    <div className="flex-1 min-h-0 rounded-2xl border overflow-hidden flex flex-col relative"
                         style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        {isPending && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl animate-in fade-in duration-150"
                                 style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(2px)' }}>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-lg"
                                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>Saving…</span>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar p-3 space-y-2">
                            {activeTasks.length === 0 && completedTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                                         style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                        <FolderKanban size={24} style={{ color: 'var(--app-primary)' }} />
                                    </div>
                                    <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--app-foreground)' }}>No tasks found</h3>
                                    <p className="text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>Create a task to get started</p>
                                </div>
                            ) : (
                                <>
                                    {activeTasks.map(t => (
                                        <TaskCard key={t.id} task={t} users={users}
                                                  compact={viewMode === 'list'}
                                                  onEdit={setEditingTask}
                                                  onQuickComplete={handleQuickComplete} />
                                    ))}

                                    {/* Completed tasks collapsible */}
                                    {completedTasks.length > 0 && (
                                        <div className="mt-4">
                                            <button onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors mb-2"
                                                    style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)', borderColor: 'var(--app-border)' }}>
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight size={14} className="transition-transform"
                                                                  style={{ color: 'var(--app-muted-foreground)', transform: showCompletedTasks ? 'rotate(90deg)' : 'none' }} />
                                                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Completed Tasks</span>
                                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                                          style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                        {completedTasks.length}
                                                    </span>
                                                </div>
                                            </button>
                                            {showCompletedTasks && (
                                                <div className="space-y-2">
                                                    {completedTasks.map(t => (
                                                        <TaskCard key={t.id} task={t} users={users}
                                                                  onEdit={setEditingTask}
                                                                  onQuickComplete={handleQuickComplete} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="flex-shrink-0 text-center text-[10px] font-bold uppercase tracking-widest mt-2"
                       style={{ color: 'var(--app-muted-foreground)' }}>
                        {filteredTasks.length} / {tasks.length} Tasks
                    </p>
                </div>
            </div>

            {/* ═══ MODALS ═══════════════════════════════════════════ */}
            {showCreateTask && (
                <TaskModal
                    categories={categories} users={users}
                    defaultCategoryId={typeof selectedCategoryId === 'number' ? selectedCategoryId : undefined}
                    onClose={() => setShowCreateTask(false)}
                    onSuccess={result => {
                        if (result?.id) setTasks(prev => [result, ...prev]);
                        setShowCreateTask(false);
                    }}
                />
            )}

            {editingTask && (
                <TaskModal
                    task={editingTask} categories={categories} users={users}
                    onClose={() => setEditingTask(null)}
                    onSuccess={result => {
                        if (result?.deleted) setTasks(prev => prev.filter(t => t.id !== result.id));
                        else if (result?.id) setTasks(prev => prev.map(t => t.id === result.id ? result : t));
                        setEditingTask(null);
                    }}
                />
            )}

            {showCategoryManagement && (
                <CategoryManagementModal
                    categories={categories}
                    onClose={() => setShowCategoryManagement(false)}
                    onUpdate={() => { setShowCategoryManagement(false); reload(); }}
                />
            )}
        </div>
    );
}
