'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import {
    Plus, Search, Play, CheckCircle2, Clock, AlertTriangle,
    ClipboardList, Loader2, Maximize2, Minimize2,
    FolderKanban, ChevronRight, Filter, Menu, Calendar, Settings2, Bell,
} from 'lucide-react';

import type { Task, Category, UserItem, Dashboard, CategorySelection, StatusFilter } from './types';
import { getUserName } from './types';
import CategorySidebar from './CategorySidebar';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import CategoryManagementModal from './CategoryManagementModal';
import {
    TaskCustomizePanel,
    loadProfiles as loadTaskProfiles,
    saveProfiles as saveTaskProfiles,
    loadActiveProfileId as loadTaskActiveId,
    saveActiveProfileId as saveTaskActiveId,
    DEFAULT_VISIBLE_FILTERS as DEFAULT_TASK_FILTERS,
    type TaskViewProfile,
    type FilterKey,
} from './TaskCustomizePanel';

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
    // Default window: one month back to one month forward, centered on today.
    const _toIso = (d: Date) => d.toISOString().split('T')[0];
    const _shiftDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c };
    const _today = new Date();
    const [filterStartDate, setFilterStartDate] = useState(_toIso(_shiftDays(_today, -30)));
    const [filterEndDate, setFilterEndDate] = useState(_toIso(_shiftDays(_today, 30)));
    const [filterAssignee, setFilterAssignee] = useState<number | 'ALL'>('ALL');
    const [filterCreator, setFilterCreator] = useState<number | 'ALL'>('ALL');
    const [filterSource, setFilterSource] = useState<'ALL' | 'SYSTEM' | 'MANUAL'>('ALL');
    const [customRanges, setCustomRanges] = useState<{ name: string; daysBefore: number; daysAfter: number }[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('tsf_task_custom_ranges') || '[]') } catch { return [] }
    });
    const [showFilters, setShowFilters] = useState(false);
    const [showFilterCustomize, setShowFilterCustomize] = useState(false);
    const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
    const [filterHasLink, setFilterHasLink] = useState<'ALL' | 'YES' | 'NO'>('ALL');

    // Per-filter visibility + named profiles (mirrors /inventory/products).
    const [profiles, setProfiles] = useState<TaskViewProfile[]>(() => loadTaskProfiles());
    const [activeProfileId, setActiveProfileId] = useState<string>(() => loadTaskActiveId());
    const _activeProfile = profiles.find(p => p.id === activeProfileId);
    const [visibleFilters, setVisibleFilters] = useState<Record<FilterKey, boolean>>(
        _activeProfile?.filters ?? DEFAULT_TASK_FILTERS,
    );
    const _setVisibleFiltersPersisted = (next: Record<FilterKey, boolean>) => {
        setVisibleFilters(next);
        const updated = profiles.map(p => p.id === activeProfileId ? { ...p, filters: next } : p);
        setProfiles(updated); saveTaskProfiles(updated);
    };
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

        // Date range — matches against due_date OR created_at so an un-dated task
        // still shows in a "last month" window based on when it was created.
        const inRange = (dateStr?: string) =>
            !!dateStr && (!filterStartDate || dateStr >= filterStartDate) && (!filterEndDate || dateStr <= filterEndDate);
        if (filterStartDate || filterEndDate) {
            filtered = filtered.filter(t => inRange(t.due_date) || inRange((t.created_at || '').slice(0, 10)));
        }

        // Assignee / Creator / Source
        if (filterAssignee !== 'ALL') filtered = filtered.filter(t => t.assigned_to === filterAssignee);
        if (filterCreator !== 'ALL') filtered = filtered.filter(t => t.assigned_by === filterCreator);
        if (filterSource !== 'ALL') {
            filtered = filtered.filter(t => filterSource === 'SYSTEM'
                ? (t.source === 'SYSTEM' || t.source === 'AUTO')
                : t.source === filterSource);
        }

        // Overdue + source-link filters
        if (filterOverdueOnly) filtered = filtered.filter(t => !!t.is_overdue);
        if (filterHasLink !== 'ALL') {
            filtered = filtered.filter(t => filterHasLink === 'YES' ? !!t.related_object_type : !t.related_object_type);
        }

        return filtered;
    };

    const filteredTasks = getFilteredTasks();
    const activeTasks = filteredTasks.filter(t => t.status !== 'COMPLETED');
    const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED');

    // KPIs reflect the current filter — so every chip and the header count
    // update live when the user narrows/widens the view.
    const _todayIso = _toIso(_today);
    const kpiStats = {
        total: filteredTasks.length,
        today: filteredTasks.filter(t =>
            (t.due_date && t.due_date.slice(0, 10) === _todayIso) ||
            (t.created_at && t.created_at.slice(0, 10) === _todayIso)
        ).length,
        pending: filteredTasks.filter(t => t.status === 'PENDING').length,
        in_progress: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: completedTasks.length,
        overdue: filteredTasks.filter(t => t.is_overdue).length,
    };
    const defaultStart = _toIso(_shiftDays(_today, -30));
    const defaultEnd = _toIso(_shiftDays(_today, 30));
    const hasActiveFilters = filterStatus !== 'ALL' || filterPriority !== 'ALL'
        || filterStartDate !== defaultStart || filterEndDate !== defaultEnd
        || filterAssignee !== 'ALL' || filterCreator !== 'ALL' || filterSource !== 'ALL'
        || filterOverdueOnly || filterHasLink !== 'ALL';

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
        setFilterStartDate(defaultStart);
        setFilterEndDate(defaultEnd);
        setFilterAssignee('ALL');
        setFilterCreator('ALL');
        setFilterSource('ALL');
        setFilterOverdueOnly(false);
        setFilterHasLink('ALL');
    };

    /** Apply a date preset by offsets relative to today. */
    const applyDatePreset = (startOffset: number, endOffset: number) => {
        setFilterStartDate(_toIso(_shiftDays(_today, startOffset)));
        setFilterEndDate(_toIso(_shiftDays(_today, endOffset)));
    };

    const DATE_PRESETS: { label: string; start: number; end: number }[] = [
        { label: 'Today', start: 0, end: 0 },
        { label: 'Yesterday', start: -1, end: -1 },
        { label: 'Tomorrow', start: 1, end: 1 },
        { label: 'Last week', start: -7, end: 0 },
        { label: 'Next week', start: 0, end: 7 },
        { label: 'Last month', start: -30, end: 0 },
        { label: 'Next month', start: 0, end: 30 },
        { label: '±30d', start: -30, end: 30 },
    ];

    const saveCustomRange = () => {
        const name = window.prompt('Name this date range (e.g. 15-period)');
        if (!name) return;
        const daysBefore = window.prompt('Days before today (e.g. 15)', '15');
        const daysAfter = window.prompt('Days after today (e.g. 15)', '15');
        const b = Number(daysBefore), a = Number(daysAfter);
        if (!Number.isFinite(b) || !Number.isFinite(a)) return;
        const next = [...customRanges.filter(r => r.name !== name), { name, daysBefore: b, daysAfter: a }];
        setCustomRanges(next);
        try { localStorage.setItem('tsf_task_custom_ranges', JSON.stringify(next)) } catch {}
        applyDatePreset(-b, a);
    };

    const deleteCustomRange = (name: string) => {
        const next = customRanges.filter(r => r.name !== name);
        setCustomRanges(next);
        try { localStorage.setItem('tsf_task_custom_ranges', JSON.stringify(next)) } catch {}
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
                        {kpiStats.total} Tasks · {kpiStats.pending} Pending · {kpiStats.overdue} Overdue
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => window.dispatchEvent(new CustomEvent('tsf:test-reminder', { detail: { title: '🧪 Test reminder — pretend a rule just fired', priority: 'URGENT', related_object_label: 'Click "Open task" to land on the Task Board' } }))}
                        title="Fire a simulated reminder popup (this browser only)"
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                        <Bell size={13} /> Test Reminder
                    </button>
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
            {!focusMode && (() => {
                const isToday = filterStartDate === _todayIso && filterEndDate === _todayIso;
                const isAll = filterStatus === 'ALL' && !isToday && filterSource === 'ALL';
                const kpis = [
                    {
                        label: 'All',
                        value: kpiStats.total,
                        color: 'var(--app-primary)',
                        icon: <ClipboardList size={14} />,
                        active: isAll,
                        onClick: () => { clearFilters(); },
                    },
                    {
                        label: 'Today',
                        value: kpiStats.today,
                        color: 'var(--app-info, #3b82f6)',
                        icon: <Calendar size={14} />,
                        active: isToday,
                        onClick: () => { setFilterStartDate(_todayIso); setFilterEndDate(_todayIso); },
                    },
                    {
                        label: 'Pending',
                        value: kpiStats.pending,
                        color: 'var(--app-warning, #f59e0b)',
                        icon: <Clock size={14} />,
                        active: filterStatus === 'PENDING',
                        onClick: () => setFilterStatus(filterStatus === 'PENDING' ? 'ALL' : 'PENDING'),
                    },
                    {
                        label: 'In Progress',
                        value: kpiStats.in_progress,
                        color: 'var(--app-info, #3b82f6)',
                        icon: <Play size={14} />,
                        active: filterStatus === 'IN_PROGRESS',
                        onClick: () => setFilterStatus(filterStatus === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'),
                    },
                    {
                        label: 'Done',
                        value: kpiStats.completed,
                        color: 'var(--app-success, #22c55e)',
                        icon: <CheckCircle2 size={14} />,
                        active: filterStatus === 'COMPLETED',
                        onClick: () => setFilterStatus(filterStatus === 'COMPLETED' ? 'ALL' : 'COMPLETED'),
                    },
                    {
                        label: 'Overdue',
                        value: kpiStats.overdue,
                        color: 'var(--app-error, #ef4444)',
                        icon: <AlertTriangle size={14} />,
                        active: false,
                        onClick: () => { /* visual-only — overdue chips already show red */ },
                    },
                ];
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}
                         className="flex-shrink-0 mb-4">
                        {kpis.map(k => (
                            <button key={k.label} onClick={k.onClick}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                style={{
                                    background: k.active ? `color-mix(in srgb, ${k.color} 10%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: `1px solid ${k.active ? k.color : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${k.color} ${k.active ? 18 : 10}%, transparent)`, color: k.color }}>
                                    {k.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: k.active ? k.color : 'var(--app-muted-foreground)' }}>{k.label}</div>
                                    <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                );
            })()}

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

                    {/* Filter panel — grid of all enabled filters (products-style) */}
                    {showFilters && (() => {
                        const fieldLabelCls = "text-[9px] font-black uppercase tracking-widest mb-1 block";
                        const fieldSelectCls = "w-full px-2.5 py-2 text-[12px] font-bold rounded-xl outline-none";
                        const fieldSelectStyle = { background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' };
                        return (
                        <div className="mb-3 p-3 rounded-xl border space-y-3"
                             style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                            {/* Customize toolbar — opens slide-in side panel (products-style) */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Filters · {Object.values(visibleFilters).filter(Boolean).length} shown · View: {profiles.find(p => p.id === activeProfileId)?.name || 'Default'}
                                </span>
                                <button onClick={() => setShowFilterCustomize(true)}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <Settings2 size={11} /> Customize
                                </button>
                            </div>

                            {/* Filter grid — as many columns as fit */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                {visibleFilters.status && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Status</label>
                                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">All Status</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="COMPLETED">Completed</option>
                                            <option value="CANCELLED">Cancelled</option>
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.priority && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Priority</label>
                                        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">All Priorities</option>
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.source && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Source</label>
                                        <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">Auto + Manual</option>
                                            <option value="SYSTEM">Auto (rules)</option>
                                            <option value="MANUAL">Manual only</option>
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.assignee && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Assigned to</label>
                                        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">Anyone</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{getUserName(u)}</option>)}
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.creator && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Created by</label>
                                        <select value={filterCreator} onChange={e => setFilterCreator(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">Anyone</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{getUserName(u)}</option>)}
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.overdue && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Overdue</label>
                                        <select value={filterOverdueOnly ? 'YES' : 'ALL'} onChange={e => setFilterOverdueOnly(e.target.value === 'YES')} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">All tasks</option>
                                            <option value="YES">Overdue only</option>
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.hasLink && (
                                    <div>
                                        <label className={fieldLabelCls} style={{ color: 'var(--app-muted-foreground)' }}>Has source link</label>
                                        <select value={filterHasLink} onChange={e => setFilterHasLink(e.target.value as any)} className={fieldSelectCls} style={fieldSelectStyle}>
                                            <option value="ALL">All</option>
                                            <option value="YES">With link</option>
                                            <option value="NO">Without link</option>
                                        </select>
                                    </div>
                                )}
                                {visibleFilters.dateRange && (
                                    <>
                                        <div>
                                            <label className={`${fieldLabelCls} flex items-center gap-1`} style={{ color: 'var(--app-muted-foreground)' }}>
                                                <Calendar size={9} /> Start Date
                                            </label>
                                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className={fieldSelectCls} style={fieldSelectStyle} />
                                        </div>
                                        <div>
                                            <label className={`${fieldLabelCls} flex items-center gap-1`} style={{ color: 'var(--app-muted-foreground)' }}>
                                                <Calendar size={9} /> End Date
                                            </label>
                                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className={fieldSelectCls} style={fieldSelectStyle} />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Date presets row — always shown when Date range is visible */}
                            {visibleFilters.dateRange && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {DATE_PRESETS.map(p => (
                                        <button key={p.label} onClick={() => applyDatePreset(p.start, p.end)}
                                                className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                            {p.label}
                                        </button>
                                    ))}
                                    {customRanges.map(r => (
                                        <span key={r.name} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                                              style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                            <button onClick={() => applyDatePreset(-r.daysBefore, r.daysAfter)} className="font-bold" title={`−${r.daysBefore} / +${r.daysAfter}`}>
                                                {r.name}
                                            </button>
                                            <button onClick={() => deleteCustomRange(r.name)} title="Delete" className="opacity-70 hover:opacity-100">×</button>
                                        </span>
                                    ))}
                                    <button onClick={saveCustomRange}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                                            style={{ background: 'transparent', color: 'var(--app-muted-foreground)', border: '1px dashed var(--app-border)' }}>
                                        + Save range
                                    </button>
                                </div>
                            )}
                            {hasActiveFilters && (
                                <div className="mt-2 flex justify-end">
                                    <button onClick={clearFilters} className="text-[11px] font-bold" style={{ color: 'var(--app-primary)' }}>
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>
                        );
                    })()}

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

            <TaskCustomizePanel
                isOpen={showFilterCustomize}
                onClose={() => setShowFilterCustomize(false)}
                visibleFilters={visibleFilters}
                setVisibleFilters={_setVisibleFiltersPersisted}
                profiles={profiles}
                setProfiles={setProfiles}
                activeProfileId={activeProfileId}
                setActiveProfileId={id => { setActiveProfileId(id); saveTaskActiveId(id); }}
            />
        </div>
    );
}
