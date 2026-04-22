'use client';

/**
 * Task Modal — Conversational form
 * =================================
 * Philosophy: this isn't a settings panel — it's a sentence being written.
 *
 *   • The title is the hero. No label, no border, giant font. You just type
 *     what needs doing.
 *   • Description flows directly below — same treatment, no box, lighter.
 *   • Metadata is compact *chips* (priority, due, assignee, category, points).
 *     You tap a chip to edit inline — no full dropdowns pinned to the layout.
 *   • Advanced knobs (recurring, proof-of-work, checklist) are collapsed
 *     behind a single "Advanced ▾" toggle so the default view is one clean
 *     column of decisions.
 *   • Cancel/Create sit at the bottom right, mobile-safe.
 *
 * The dialog is a sheet on mobile (bottom-anchored) and a centered card on
 * desktop — controlled purely by the max-w-lg + bottom layout we already use.
 */

import { useState, useRef, useEffect, useTransition } from 'react';
import {
    X, Trash2, Calendar, User as UserIcon, Flag, FolderKanban, Star,
    ChevronDown, Repeat, Lock, ListChecks, Check,
} from 'lucide-react';
import type { Task, Category, UserItem } from './types';

interface TaskModalProps {
    task?: Task | null;
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
}

const PRIORITIES: { key: string; label: string; color: string }[] = [
    { key: 'LOW', label: 'Low', color: 'var(--app-muted-foreground)' },
    { key: 'MEDIUM', label: 'Medium', color: 'var(--app-info, #3b82f6)' },
    { key: 'HIGH', label: 'High', color: 'var(--app-warning, #f59e0b)' },
    { key: 'URGENT', label: 'Urgent', color: 'var(--app-error, #ef4444)' },
];

const STATUSES: { key: string; label: string }[] = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'IN_PROGRESS', label: 'In progress' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

/** Friendly label for a stored ISO datetime-local string. */
function formatDue(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((dueStart.getTime() - dayStart.getTime()) / 86_400_000);
    if (diffDays === 0) return `Today · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (diffDays === 1) return `Tomorrow · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (diffDays === -1) return `Yesterday · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TaskModal({
    task,
    categories,
    users,
    defaultCategoryId,
    onClose,
    onSuccess,
}: TaskModalProps) {
    const isEdit = !!task;
    const titleRef = useRef<HTMLTextAreaElement | null>(null);

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
    const [requireProof, setRequireProof] = useState(!!task?.require_completion_note);
    const [checklistText, setChecklistText] = useState(
        (task?.completion_checklist || []).map(i => i.label).join('\n')
    );

    // Track which chip is "open" (editor expanded inline). Only one at a time
    // so the sheet stays a clean single-column flow.
    const [openChip, setOpenChip] = useState<null | 'priority' | 'due' | 'assignee' | 'category' | 'points' | 'status'>(null);
    const [showAdvanced, setShowAdvanced] = useState(Boolean(task?.is_recurring || task?.require_completion_note || task?.completion_checklist?.length));

    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    // Autofocus title on open (creation mode). Edit mode leaves cursor alone.
    useEffect(() => {
        if (!isEdit && titleRef.current) titleRef.current.focus();
    }, [isEdit]);

    // Auto-resize title + description textareas to fit content, for the
    // borderless feel.
    const autosize = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

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
        } else {
            data.is_recurring = false;
        }
        data.require_completion_note = requireProof;
        const checklist = checklistText
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .map(label => {
                const existing = (task?.completion_checklist || []).find(i => i.label === label);
                return { label, checked: existing?.checked || false };
            });
        data.completion_checklist = checklist;

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

    const getUserDisplayName = (u: UserItem) =>
        u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.username;

    // Resolved display values for chips
    const priorityMeta = PRIORITIES.find(p => p.key === priority) ?? PRIORITIES[1];
    const assignedUser = assignedTo ? users.find(u => u.id === Number(assignedTo)) : null;
    const categoryMeta = categoryId ? categories.find(c => c.id === Number(categoryId)) : null;
    const checklistCount = checklistText.split('\n').map(s => s.trim()).filter(Boolean).length;

    // Chip style — consistent pill
    const chipStyle = (active: boolean, tintColor?: string) => ({
        background: active && tintColor ? `color-mix(in srgb, ${tintColor} 12%, transparent)` : 'var(--app-bg)',
        border: `1px solid ${active && tintColor ? `color-mix(in srgb, ${tintColor} 35%, transparent)` : 'var(--app-border)'}`,
        color: active && tintColor ? tintColor : 'var(--app-foreground)',
    });

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 55%, transparent)', backdropFilter: 'blur(10px)' }}
             onClick={onClose}>
            <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                {/* Header — minimal. Just a close button + subtle mode tag. */}
                <div className="sticky top-0 z-10 px-5 pt-4 pb-2 flex items-center justify-between"
                     style={{ background: 'var(--app-surface)' }}>
                    <span className="text-tp-xxs font-black uppercase tracking-widest"
                          style={{ color: 'var(--app-muted-foreground)' }}>
                        {isEdit ? 'Editing task' : 'New task'}
                    </span>
                    <button type="button" onClick={onClose}
                            className="p-1.5 rounded-full transition-all hover:bg-app-bg/60"
                            style={{ color: 'var(--app-muted-foreground)' }}
                            aria-label="Close">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
                    {error && (
                        <div className="px-3 py-2 rounded-xl text-tp-sm font-bold"
                             style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                            {error}
                        </div>
                    )}

                    {/* ── Hero: title + description, borderless ── */}
                    <div>
                        <textarea
                            ref={titleRef}
                            value={title}
                            onChange={e => { setTitle(e.target.value); autosize(e.target); }}
                            onInput={e => autosize(e.currentTarget)}
                            placeholder="What needs to be done?"
                            required
                            rows={1}
                            className="w-full resize-none outline-none bg-transparent text-2xl md:text-3xl font-black leading-tight placeholder:opacity-40"
                            style={{ color: 'var(--app-foreground)' }}
                        />
                        <textarea
                            value={description}
                            onChange={e => { setDescription(e.target.value); autosize(e.target); }}
                            onInput={e => autosize(e.currentTarget)}
                            placeholder="Add a description, context, or notes…"
                            rows={1}
                            className="w-full mt-2 resize-none outline-none bg-transparent text-tp-md font-medium leading-relaxed placeholder:opacity-40"
                            style={{ color: 'var(--app-muted-foreground)' }}
                        />
                    </div>

                    {/* ── Chip row: priority, due, assignee, category, points ── */}
                    <div className="flex flex-wrap gap-2">
                        {/* Priority */}
                        <button type="button" onClick={() => setOpenChip(openChip === 'priority' ? null : 'priority')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                style={chipStyle(true, priorityMeta.color)}>
                            <Flag size={12} />
                            {priorityMeta.label}
                        </button>

                        {/* Due date */}
                        <button type="button" onClick={() => setOpenChip(openChip === 'due' ? null : 'due')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                style={chipStyle(!!dueDate, 'var(--app-primary)')}>
                            <Calendar size={12} />
                            {dueDate ? formatDue(dueDate) : 'No due date'}
                        </button>

                        {/* Assignee */}
                        <button type="button" onClick={() => setOpenChip(openChip === 'assignee' ? null : 'assignee')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                style={chipStyle(!!assignedUser, 'var(--app-info, #3b82f6)')}>
                            <UserIcon size={12} />
                            {assignedUser ? getUserDisplayName(assignedUser) : 'Unassigned'}
                        </button>

                        {/* Category */}
                        {categories.length > 0 && (
                            <button type="button" onClick={() => setOpenChip(openChip === 'category' ? null : 'category')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                    style={chipStyle(!!categoryMeta, categoryMeta?.color || 'var(--app-primary)')}>
                                <FolderKanban size={12} />
                                {categoryMeta?.name || 'No category'}
                            </button>
                        )}

                        {/* Points */}
                        <button type="button" onClick={() => setOpenChip(openChip === 'points' ? null : 'points')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                style={chipStyle(true, 'var(--app-warning, #f59e0b)')}>
                            <Star size={12} />
                            {points} pt{points === '1' ? '' : 's'}
                        </button>

                        {/* Status — only in edit mode */}
                        {isEdit && (
                            <button type="button" onClick={() => setOpenChip(openChip === 'status' ? null : 'status')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold transition-all"
                                    style={chipStyle(true, 'var(--app-muted-foreground)')}>
                                {STATUSES.find(s => s.key === status)?.label ?? status}
                            </button>
                        )}
                    </div>

                    {/* ── Inline editor for the active chip ── */}
                    {openChip === 'priority' && (
                        <div className="p-3 rounded-2xl grid grid-cols-4 gap-2"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {PRIORITIES.map(p => (
                                <button key={p.key} type="button"
                                        onClick={() => { setPriority(p.key); setOpenChip(null); }}
                                        className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all"
                                        style={{
                                            background: priority === p.key ? `color-mix(in srgb, ${p.color} 15%, transparent)` : 'transparent',
                                            border: `1px solid ${priority === p.key ? `color-mix(in srgb, ${p.color} 40%, transparent)` : 'transparent'}`,
                                        }}>
                                    <Flag size={14} style={{ color: p.color }} />
                                    <span className="text-tp-xs font-bold" style={{ color: priority === p.key ? p.color : 'var(--app-foreground)' }}>{p.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {openChip === 'due' && (
                        <div className="p-3 rounded-2xl space-y-2"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="flex flex-wrap gap-1.5">
                                {([
                                    { label: 'Today', days: 0 },
                                    { label: 'Tomorrow', days: 1 },
                                    { label: 'In 3 days', days: 3 },
                                    { label: 'Next week', days: 7 },
                                    { label: 'In 2 weeks', days: 14 },
                                ] as const).map(opt => (
                                    <button key={opt.label} type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + opt.days);
                                                d.setHours(17, 0, 0, 0);
                                                setDueDate(d.toISOString().slice(0, 16));
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-tp-xs font-bold transition-all"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        {opt.label}
                                    </button>
                                ))}
                                {dueDate && (
                                    <button type="button" onClick={() => setDueDate('')}
                                            className="px-2.5 py-1 rounded-lg text-tp-xs font-bold transition-all"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                   className="w-full text-tp-md font-bold px-3 py-2 rounded-xl outline-none"
                                   style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    )}

                    {openChip === 'assignee' && (
                        <div className="p-2 rounded-2xl max-h-52 overflow-y-auto custom-scrollbar"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <button type="button"
                                    onClick={() => { setAssignedTo(''); setOpenChip(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left transition-all hover:bg-app-surface/60"
                                    style={{ color: !assignedTo ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                <UserIcon size={13} /> Unassigned
                                {!assignedTo && <Check size={13} className="ml-auto" />}
                            </button>
                            {users.map(u => {
                                const active = Number(assignedTo) === u.id;
                                return (
                                    <button key={u.id} type="button"
                                            onClick={() => { setAssignedTo(u.id); setOpenChip(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left transition-all hover:bg-app-surface/60"
                                            style={{ color: active ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-tp-xs font-black flex-shrink-0"
                                             style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                            {getUserDisplayName(u).charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate">{getUserDisplayName(u)}</span>
                                        {active && <Check size={13} className="ml-auto flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {openChip === 'category' && categories.length > 0 && (
                        <div className="p-2 rounded-2xl max-h-52 overflow-y-auto custom-scrollbar"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <button type="button"
                                    onClick={() => { setCategoryId(''); setOpenChip(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left transition-all hover:bg-app-surface/60"
                                    style={{ color: !categoryId ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                <FolderKanban size={13} /> No category
                                {!categoryId && <Check size={13} className="ml-auto" />}
                            </button>
                            {categories.map(c => {
                                const active = Number(categoryId) === c.id;
                                return (
                                    <button key={c.id} type="button"
                                            onClick={() => { setCategoryId(c.id); setOpenChip(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left transition-all hover:bg-app-surface/60"
                                            style={{ color: active ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color || 'var(--app-primary)' }} />
                                        <span className="truncate">{c.name}</span>
                                        {active && <Check size={13} className="ml-auto flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {openChip === 'points' && (
                        <div className="p-3 rounded-2xl flex items-center gap-2 flex-wrap"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {[1, 2, 3, 5, 8, 13].map(n => (
                                <button key={n} type="button"
                                        onClick={() => { setPoints(String(n)); setOpenChip(null); }}
                                        className="w-10 h-10 rounded-xl text-tp-md font-black transition-all"
                                        style={{
                                            background: points === String(n) ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' : 'var(--app-surface)',
                                            border: `1px solid ${points === String(n) ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 40%, transparent)' : 'var(--app-border)'}`,
                                            color: points === String(n) ? 'var(--app-warning, #f59e0b)' : 'var(--app-foreground)',
                                        }}>
                                    {n}
                                </button>
                            ))}
                            <input type="number" min={1} value={points} onChange={e => setPoints(e.target.value)}
                                   className="w-20 text-tp-md font-bold px-3 py-2 rounded-xl outline-none"
                                   style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    )}

                    {openChip === 'status' && isEdit && (
                        <div className="p-2 rounded-2xl"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {STATUSES.map(s => {
                                const active = status === s.key;
                                return (
                                    <button key={s.key} type="button"
                                            onClick={() => { setStatus(s.key); setOpenChip(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left transition-all hover:bg-app-surface/60"
                                            style={{ color: active ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                        {s.label}
                                        {active && <Check size={13} className="ml-auto" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Advanced toggle ── */}
                    <button type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wider transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <ChevronDown size={12} className="transition-transform"
                                     style={{ transform: showAdvanced ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                        Advanced
                    </button>

                    {showAdvanced && (
                        <div className="space-y-4 pl-1">
                            {/* Recurring */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                                           className="w-4 h-4 rounded" style={{ accentColor: 'var(--app-primary)' }} />
                                    <Repeat size={13} style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Recurring task
                                    </span>
                                </label>
                                {isRecurring && (
                                    <div className="mt-2 ml-6 flex items-center gap-2">
                                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>Repeat every</span>
                                        <input type="number" min={1} max={365} value={recurrenceDays}
                                               onChange={e => setRecurrenceDays(e.target.value)}
                                               className="w-16 text-tp-md font-bold px-2 py-1 rounded-lg outline-none text-center"
                                               style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>days</span>
                                    </div>
                                )}
                            </div>

                            {/* Proof of work */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={requireProof} onChange={e => setRequireProof(e.target.checked)}
                                           className="w-4 h-4 rounded" style={{ accentColor: 'var(--app-primary)' }} />
                                    <Lock size={13} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Require proof of work
                                    </span>
                                </label>
                                <div className="text-tp-xs mt-1 ml-6" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Assignee must add a completion note{checklistCount > 0 ? ' and tick every checklist item' : ''} to close.
                                </div>
                            </div>

                            {/* Checklist */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <ListChecks size={13} style={{ color: 'var(--app-info, #3b82f6)' }} />
                                    <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Completion checklist
                                    </span>
                                    {checklistCount > 0 && (
                                        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                              style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                            {checklistCount} item{checklistCount === 1 ? '' : 's'}
                                        </span>
                                    )}
                                </div>
                                <textarea value={checklistText} onChange={e => setChecklistText(e.target.value)} rows={3}
                                          className="w-full text-tp-md font-medium px-3 py-2 rounded-xl outline-none font-mono resize-none"
                                          style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                          placeholder={'One item per line\nExample:\nVerified cash on hand\nSigned by manager'} />
                            </div>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-2 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                        {isEdit && (
                            <button type="button" onClick={handleDelete} disabled={isPending}
                                    className="flex items-center gap-1 px-3 py-2 text-tp-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-error)' }}
                                    aria-label="Delete task">
                                <Trash2 size={13} /> Delete
                            </button>
                        )}
                        <div className="flex-1" />
                        <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-tp-sm font-bold rounded-xl transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending || !title.trim()}
                                className="px-5 py-2.5 text-tp-sm font-black text-white rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                            {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
