'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import {
    Plus, Search, Play, CheckCircle2, XCircle, Clock, AlertTriangle,
    Calendar, Star, ClipboardList, Loader2, X, Maximize2, Minimize2,
    FolderKanban, ChevronDown, ChevronRight, GripVertical, User,
    Filter, Menu, Trash2, Edit2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface Task {
    id: number;
    title: string;
    description?: string;
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
    is_recurring?: boolean;
    recurrence_days?: number;
    created_at: string;
}

interface Category {
    id: number;
    name: string;
    color: string;
}

interface UserItem {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
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
    categories: Category[];
    users: UserItem[];
    dashboard: Dashboard;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

type CategorySelection = 'all' | null | number;
type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: CATEGORY MANAGEMENT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function CategoryManagementModal({
    categories,
    onClose,
    onUpdate,
}: {
    categories: Category[];
    onClose: () => void;
    onUpdate: () => void;
}) {
    const [cats, setCats] = useState(categories);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#6366f1');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setError('');
        const { createTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                const result = await createTaskCategory({ name: newName.trim(), color: newColor });
                if (result?.id) {
                    setCats(prev => [...prev, result]);
                    setNewName('');
                    setNewColor('#6366f1');
                    onUpdate();
                }
            } catch { setError('Failed to create category'); }
        });
    }

    async function handleUpdate(id: number) {
        if (!editName.trim()) return;
        setError('');
        const { updateTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                await updateTaskCategory(id, { name: editName.trim(), color: editColor });
                setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), color: editColor } : c));
                setEditingId(null);
                onUpdate();
            } catch { setError('Failed to update category'); }
        });
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this category? Tasks will become uncategorized.')) return;
        const { deleteTaskCategory } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                await deleteTaskCategory(id);
                setCats(prev => prev.filter(c => c.id !== id));
                onUpdate();
            } catch { setError('Failed to delete category'); }
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(8px)' }}
             onClick={onClose}
        >
            <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
                 style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                 onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between border-b"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <FolderKanban size={16} className="text-white" />
                        </div>
                        <h2 className="text-base font-black" style={{ color: 'var(--app-foreground)' }}>Manage Categories</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-70"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {error && (
                        <div className="px-3 py-2 rounded-xl text-[12px] font-bold"
                             style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                            {error}
                        </div>
                    )}

                    {/* Create form */}
                    <form onSubmit={handleCreate}
                          className="p-4 rounded-xl border"
                          style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                        <h3 className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--app-foreground)' }}>
                            New Category
                        </h3>
                        <div className="flex gap-2">
                            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                                   className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                   placeholder="Category name"
                                   className="flex-1 px-3 py-2 text-[13px] font-bold rounded-xl outline-none transition-all"
                                   style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <button type="submit" disabled={isPending}
                                    className="flex items-center gap-1 px-4 py-2 text-[11px] font-bold text-white rounded-xl transition-all disabled:opacity-50"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={14} /> Create
                            </button>
                        </div>
                    </form>

                    {/* List */}
                    <div className="space-y-2">
                        {cats.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
                                 style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                {editingId === cat.id ? (
                                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                                        <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                                               className="w-8 h-8 rounded cursor-pointer border-0" />
                                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                               className="flex-1 min-w-[120px] px-2 py-1.5 text-[13px] font-bold rounded-lg outline-none"
                                               style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <button onClick={() => handleUpdate(cat.id)}
                                                className="px-3 py-1.5 text-[11px] font-bold text-white rounded-lg"
                                                style={{ background: 'var(--app-primary)' }}>Save</button>
                                        <button onClick={() => setEditingId(null)}
                                                className="px-3 py-1.5 text-[11px] font-bold rounded-lg border"
                                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.color || 'var(--app-primary)' }} />
                                        <span className="flex-1 text-[13px] font-bold" style={{ color: 'var(--app-foreground)' }}>{cat.name}</span>
                                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color || '#6366f1'); }}
                                                className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-primary)' }}>
                                            <Edit2 size={13} />
                                        </button>
                                        <button onClick={() => handleDelete(cat.id)}
                                                className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-error)' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {cats.length === 0 && (
                            <div className="text-center py-8">
                                <FolderKanban size={28} className="mx-auto mb-2" style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                                <p className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No categories yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: CREATE / EDIT TASK MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function TaskModal({
    task,
    categories,
    users,
    defaultCategoryId,
    onClose,
    onSuccess,
}: {
    task?: Task | null;
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
}) {
    const isEdit = !!task;
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
    const [status, setStatus] = useState(task?.status || 'PENDING');
    const [categoryId, setCategoryId] = useState<number | ''>(task?.category || defaultCategoryId || '');
    const [assignedTo, setAssignedTo] = useState<number | ''>(task?.assigned_to || '');
    const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.slice(0, 16) : '');
    const [points, setPoints] = useState(String(task?.points || 1));
    const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false);
    const [recurrenceDays, setRecurrenceDays] = useState(String(task?.recurrence_days || 7));
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setError('');

        const data: Record<string, unknown> = {
            title: title.trim(),
            description: description || undefined,
            priority,
            points: parseInt(points) || 1,
        };
        if (isEdit) data.status = status;
        if (categoryId) data.category = Number(categoryId);
        if (assignedTo) data.assigned_to = Number(assignedTo);
        if (dueDate) data.due_date = new Date(dueDate).toISOString();
        if (isRecurring) {
            data.is_recurring = true;
            data.recurrence_days = parseInt(recurrenceDays) || 7;
        }

        startTransition(async () => {
            try {
                if (isEdit) {
                    const { updateTask } = await import('@/app/actions/workspace');
                    const result = await updateTask(task!.id, data);
                    onSuccess(result);
                } else {
                    const { createTask } = await import('@/app/actions/workspace');
                    const result = await createTask(data);
                    if (result?.id) onSuccess(result);
                    else setError('Failed to create task');
                }
            } catch { setError(isEdit ? 'Failed to update task' : 'Failed to create task'); }
        });
    }

    async function handleDelete() {
        if (!task || !confirm('Delete this task permanently?')) return;
        const { deleteTask } = await import('@/app/actions/workspace');
        startTransition(async () => {
            try {
                await deleteTask(task.id);
                onSuccess({ deleted: true, id: task.id });
            } catch { setError('Failed to delete task'); }
        });
    }

    const inputCls = 'w-full text-[13px] font-bold px-3 py-2.5 rounded-xl outline-none transition-all';
    const inputStyle = { background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' };
    const labelCls = 'text-[10px] font-black uppercase tracking-widest mb-1.5 block';
    const labelStyle = { color: 'var(--app-muted-foreground)' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(8px)' }}
             onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
                 style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between border-b"
                     style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                    <h2 className="text-base font-black" style={{ color: 'var(--app-foreground)' }}>
                        {isEdit ? 'Edit Task' : 'Create New Task'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-70"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="px-3 py-2 rounded-xl text-[12px] font-bold"
                             style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className={labelCls} style={labelStyle}>Title *</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                               className={inputCls} style={inputStyle} placeholder="Enter task title" />
                    </div>

                    {/* Description */}
                    <div>
                        <label className={labelCls} style={labelStyle}>Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                                  className={`${inputCls} resize-none`} style={inputStyle} placeholder="Add task description" />
                    </div>

                    {/* Priority + Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} style={labelStyle}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)}
                                    className={inputCls} style={inputStyle}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls} style={labelStyle}>Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                    className={inputCls} style={inputStyle}
                                    disabled={!isEdit}>
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className={labelCls} style={labelStyle}>Category</label>
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value) : '')}
                                className={inputCls} style={inputStyle}>
                            <option value="">No category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Assign To */}
                    <div>
                        <label className={labelCls} style={labelStyle}>Assign To</label>
                        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value ? parseInt(e.target.value) : '')}
                                className={inputCls} style={inputStyle}>
                            <option value="">Unassigned</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Due Date + Points */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} style={labelStyle}>Due Date</label>
                            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                   className={inputCls} style={inputStyle} />
                        </div>
                        <div>
                            <label className={labelCls} style={labelStyle}>Points</label>
                            <input type="number" min={1} value={points} onChange={e => setPoints(e.target.value)}
                                   className={inputCls} style={inputStyle} />
                        </div>
                    </div>

                    {/* Recurring */}
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                                   className="w-4 h-4 rounded" style={{ accentColor: 'var(--app-primary)' }} />
                            <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                Make this a recurring task
                            </span>
                        </label>
                        {isRecurring && (
                            <div className="mt-3">
                                <label className={labelCls} style={labelStyle}>Repeat every (days)</label>
                                <input type="number" min={1} max={365} value={recurrenceDays}
                                       onChange={e => setRecurrenceDays(e.target.value)}
                                       className={inputCls} style={inputStyle} placeholder="e.g., 7 for weekly" />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                        {isEdit && (
                            <button type="button" onClick={handleDelete} disabled={isPending}
                                    className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold rounded-xl transition-colors disabled:opacity-50 border"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                                <Trash2 size={13} /> Delete
                            </button>
                        )}
                        <div className="flex-1" />
                        <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-[11px] font-bold rounded-xl transition-colors border"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending}
                                className="px-5 py-2.5 text-[11px] font-bold text-white rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN: TasksClient
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TasksClient({ tasks: initialTasks, categories: initialCategories, users, dashboard }: Props) {
    const [tasks, setTasks] = useState(initialTasks);
    const [categories, setCategories] = useState(initialCategories);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [focusMode, setFocusMode] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Category sidebar state
    const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>('all');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);

    // Modals
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showCategoryManagement, setShowCategoryManagement] = useState(false);

    // Drag
    const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    /* ── Reload from server ─────────────────────────────────────────── */
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
        } catch {}
    }, []);

    /* ── Category sidebar helpers ───────────────────────────────────── */
    const toggleCategoryExpanded = (catId: number) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            next.has(catId) ? next.delete(catId) : next.add(catId);
            return next;
        });
    };

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

    const getTaskCountForCategory = (catId: number | null) =>
        catId === null
            ? tasks.filter(t => !t.category).length
            : tasks.filter(t => t.category === catId).length;

    const getTaskCountForUser = (catId: number, userId: number) =>
        tasks.filter(t => t.category === catId && t.assigned_to === userId).length;

    const getUsersForCategory = (catId: number): UserItem[] => {
        const userIds = new Set(
            tasks.filter(t => t.category === catId && t.assigned_to).map(t => t.assigned_to as number)
        );
        return users.filter(u => userIds.has(u.id));
    };

    const getUserName = (u: UserItem) =>
        u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.username || 'Unknown';

    /* ── Filtering ─────────────────────────────────────────────────── */
    const getFilteredTasks = () => {
        let filtered = tasks;

        // Category filter
        if (selectedCategoryId === 'all') { /* show all */ }
        else if (selectedCategoryId === null) { filtered = filtered.filter(t => !t.category); }
        else { filtered = filtered.filter(t => t.category === selectedCategoryId); }

        // User filter
        if (selectedUserId) { filtered = filtered.filter(t => t.assigned_to === selectedUserId); }

        // Search
        if (search) { filtered = filtered.filter(t => t.title.toLowerCase().includes(search.toLowerCase())); }

        // Status
        if (filterStatus !== 'ALL') { filtered = filtered.filter(t => t.status === filterStatus); }

        // Priority
        if (filterPriority !== 'ALL') { filtered = filtered.filter(t => t.priority === filterPriority); }

        // Date range
        if (filterStartDate) { filtered = filtered.filter(t => t.due_date && t.due_date >= filterStartDate); }
        if (filterEndDate) { filtered = filtered.filter(t => t.due_date && t.due_date <= filterEndDate); }

        return filtered;
    };

    const filteredTasks = getFilteredTasks();
    const activeTasks = filteredTasks.filter(t => t.status !== 'COMPLETED');
    const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED');
    const hasActiveFilters = filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterStartDate || filterEndDate;

    /* ── Quick-complete toggle ─────────────────────────────────────── */
    async function handleQuickComplete(taskId: number, currentStatus: string, e: React.MouseEvent) {
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
            } catch {}
        });
    }

    /* ── Quick-action buttons ──────────────────────────────────────── */
    async function handleAction(taskId: number, action: 'start' | 'complete' | 'cancel') {
        const mod = await import('@/app/actions/workspace');
        const fn = action === 'start' ? mod.startTask : action === 'complete' ? mod.completeTask : mod.cancelTask;
        startTransition(async () => {
            await fn(taskId);
            setTasks(prev => prev.map(t => t.id === taskId ? {
                ...t, status: action === 'start' ? 'IN_PROGRESS' : action === 'complete' ? 'COMPLETED' : 'CANCELLED',
            } : t));
        });
    }

    /* ── Display title based on selection ───────────────────────────── */
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

    const clearFilters = () => { setFilterStatus('ALL'); setFilterPriority('ALL'); setFilterStartDate(''); setFilterEndDate(''); };

    /* ═══════════════════════════════════════════════════════════════
       SIDEBAR COMPONENT (used in both desktop and mobile)
       ═══════════════════════════════════════════════════════════════ */

    const SidebarContent = () => (
        <div className="rounded-2xl border overflow-hidden"
             style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
                 style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))', borderColor: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                <h3 className="text-[12px] font-black flex items-center gap-2" style={{ color: 'var(--app-foreground)' }}>
                    <FolderKanban size={15} style={{ color: 'var(--app-primary)' }} />
                    Categories
                </h3>
                <div className="flex items-center gap-1">
                    <button onClick={() => setShowCategoryManagement(true)}
                            className="p-1 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-primary)' }}>
                        <Edit2 size={12} />
                    </button>
                    <button onClick={() => setShowMobileSidebar(false)}
                            className="lg:hidden p-1 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
                {/* All Tasks */}
                <button onClick={() => handleCategoryClick('all')}
                        className="w-full px-4 py-2.5 flex items-center justify-between transition-colors border-b text-left"
                        style={{
                            borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                            background: selectedCategoryId === 'all' && !selectedUserId
                                ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                            borderLeft: selectedCategoryId === 'all' && !selectedUserId
                                ? '3px solid var(--app-primary)' : '3px solid transparent',
                        }}>
                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>All Tasks</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {tasks.length}
                    </span>
                </button>

                {/* Uncategorized */}
                {getTaskCountForCategory(null) > 0 && (
                    <button onClick={() => handleCategoryClick(null)}
                            className="w-full px-4 py-2.5 flex items-center justify-between transition-colors border-b text-left"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                background: selectedCategoryId === null && !selectedUserId
                                    ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                                borderLeft: selectedCategoryId === null && !selectedUserId
                                    ? '3px solid var(--app-primary)' : '3px solid transparent',
                            }}>
                        <span className="text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Uncategorized</span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                              style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                            {getTaskCountForCategory(null)}
                        </span>
                    </button>
                )}

                {/* Category items */}
                {categories.map(cat => {
                    const catUsers = getUsersForCategory(cat.id);
                    const isExpanded = expandedCategories.has(cat.id);
                    const hasUsers = catUsers.length > 0;
                    const isSelected = selectedCategoryId === cat.id && !selectedUserId;

                    return (
                        <div key={cat.id}
                             draggable onDragStart={() => setDraggedCategoryId(cat.id)}
                             onDragOver={e => { e.preventDefault(); }}
                             onDragEnd={() => setDraggedCategoryId(null)}
                             className="border-b"
                             style={{
                                 borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                 opacity: draggedCategoryId === cat.id ? 0.5 : 1,
                             }}>
                            <div className="flex items-center"
                                 style={{
                                     background: isSelected ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                                     borderLeft: isSelected ? '3px solid var(--app-primary)' : '3px solid transparent',
                                 }}>
                                {hasUsers && (
                                    <button onClick={() => toggleCategoryExpanded(cat.id)}
                                            className="px-1.5 py-2.5 transition-colors hover:opacity-70" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                    </button>
                                )}
                                <button onClick={() => handleCategoryClick(cat.id)}
                                        className={`flex-1 py-2.5 flex items-center justify-between transition-colors text-left ${hasUsers ? 'pl-0' : 'pl-3'} pr-3`}>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <GripVertical size={12} className="flex-shrink-0 cursor-grab active:cursor-grabbing" style={{ color: 'var(--app-muted-foreground)', opacity: 0.5 }} />
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color || 'var(--app-primary)' }} />
                                        <span className="text-[12px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{cat.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full ml-2"
                                          style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                        {getTaskCountForCategory(cat.id)}
                                    </span>
                                </button>
                            </div>

                            {/* User sub-items */}
                            {isExpanded && catUsers.length > 0 && (
                                <div style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)' }}>
                                    {catUsers.map(u => {
                                        const isUserSelected = selectedCategoryId === cat.id && selectedUserId === u.id;
                                        return (
                                            <button key={u.id}
                                                    onClick={() => handleUserClick(cat.id, u.id)}
                                                    className="w-full pl-10 pr-3 py-2 flex items-center justify-between transition-colors text-left"
                                                    style={{
                                                        background: isUserSelected ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                                        borderLeft: isUserSelected ? '3px solid var(--app-primary)' : '3px solid transparent',
                                                    }}>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <User size={12} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />
                                                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                        {getUserName(u)}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-2"
                                                      style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {getTaskCountForUser(cat.id, u.id)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="px-4 py-8 text-center">
                        <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No categories yet.</p>
                        <button onClick={() => setShowCategoryManagement(true)}
                                className="mt-1 text-[11px] font-bold" style={{ color: 'var(--app-primary)' }}>
                            Create one →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TASK CARD COMPONENT
       ═══════════════════════════════════════════════════════════════ */

    const TaskCard = ({ task: t }: { task: Task }) => {
        const StatusIcon = STATUS_ICONS[t.status] ?? Clock;
        const statusColor = STATUS_COLOR[t.status] ?? 'var(--app-muted-foreground)';
        const priorityColor = PRIORITY_COLOR[t.priority] ?? 'var(--app-muted-foreground)';
        const isCompleted = t.status === 'COMPLETED';

        return (
            <div onClick={() => setEditingTask(t)}
                 className="group rounded-xl border p-4 transition-all duration-200 cursor-pointer"
                 style={{
                     background: 'var(--app-surface)',
                     borderColor: 'var(--app-border)',
                     borderLeft: `3px solid ${statusColor}`,
                     opacity: isCompleted ? 0.6 : 1,
                 }}>
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                             style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}>
                            <StatusIcon size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`text-[13px] font-bold mb-0.5 ${isCompleted ? 'line-through' : ''}`}
                                style={{ color: isCompleted ? 'var(--app-muted-foreground)' : 'var(--app-foreground)' }}>
                                {t.title}
                            </h3>
                            {t.description && (
                                <p className="text-[11px] font-medium line-clamp-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {t.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: `color-mix(in srgb, ${priorityColor} 10%, transparent)`, color: priorityColor, border: `1px solid color-mix(in srgb, ${priorityColor} 25%, transparent)` }}>
                            {t.priority?.toLowerCase()}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor, border: `1px solid color-mix(in srgb, ${statusColor} 25%, transparent)` }}>
                            {t.status?.toLowerCase().replace('_', ' ')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                        {t.category_name && (
                            <span className="flex items-center gap-1">
                                <FolderKanban size={10} /> {t.category_name}
                            </span>
                        )}
                        {t.due_date && (
                            <span className="flex items-center gap-1" style={t.is_overdue ? { color: 'var(--app-error)', fontWeight: 700 } : undefined}>
                                <Calendar size={10} /> Due {new Date(t.due_date).toLocaleDateString()}
                            </span>
                        )}
                        {t.assigned_to_name && (
                            <span className="flex items-center gap-1">
                                <User size={10} /> {t.assigned_to_name}
                            </span>
                        )}
                        {t.points > 0 && (
                            <span className="flex items-center gap-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                <Star size={10} /> {t.points}
                            </span>
                        )}
                    </div>

                    {/* Toggle switch */}
                    <button onClick={e => handleQuickComplete(t.id, t.status, e)}
                            className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out"
                            style={{
                                background: isCompleted ? 'var(--app-success, #22c55e)' : 'color-mix(in srgb, var(--app-muted-foreground) 25%, transparent)',
                                border: '2px solid transparent',
                            }}
                            title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}>
                        <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
                              style={{ transform: isCompleted ? 'translateX(16px)' : 'translateX(0)' }} />
                    </button>
                </div>
            </div>
        );
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
                    <div className="lg:hidden fixed inset-0 z-30" style={{ background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', backdropFilter: 'blur(6px)' }}
                         onClick={() => setShowMobileSidebar(false)}>
                        <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw]" onClick={e => e.stopPropagation()}>
                            <SidebarContent />
                        </div>
                    </div>
                )}

                {/* Desktop sidebar */}
                <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
                    <div className="sticky top-24">
                        <SidebarContent />
                    </div>
                </div>

                {/* ── Tasks Area ─────────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {/* Tasks header */}
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
                                {hasActiveFilters && (
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                                )}
                            </button>

                            {/* New Task button */}
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
                                    {activeTasks.map(t => <TaskCard key={t.id} task={t} />)}

                                    {/* Completed tasks section */}
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
                                                    {completedTasks.map(t => <TaskCard key={t.id} task={t} />)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer count */}
                    <p className="flex-shrink-0 text-center text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--app-muted-foreground)' }}>
                        {filteredTasks.length} / {tasks.length} Tasks
                    </p>
                </div>
            </div>

            {/* ═══ MODALS ═══════════════════════════════════════════ */}
            {showCreateTask && (
                <TaskModal
                    categories={categories}
                    users={users}
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
                    task={editingTask}
                    categories={categories}
                    users={users}
                    onClose={() => setEditingTask(null)}
                    onSuccess={result => {
                        if (result?.deleted) {
                            setTasks(prev => prev.filter(t => t.id !== result.id));
                        } else if (result?.id) {
                            setTasks(prev => prev.map(t => t.id === result.id ? result : t));
                        }
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
