'use client';

/**
 * Card = Form (Variant C) — WYSIWYG task editor
 * =============================================
 * The modal looks exactly like the TaskCard that'll appear in the list.
 * No distinction between "edit view" and "display view" — you click a field
 * on the card and it becomes editable in place.
 *
 * Philosophy: no mental translation. What you type IS what appears in the
 * Tasks list. Useful for people who think visually and for demos where the
 * product story is "look how clean your tasks look."
 */

import { useState, useRef, useEffect, useTransition } from 'react';
import {
    X, Flag, Calendar, User as UserIcon, FolderKanban, Star, Clock, Check,
} from 'lucide-react';
import type { Category, UserItem } from './types';

interface Props {
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

function formatDue(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TaskModalCard({ categories, users, defaultCategoryId, onClose, onSuccess }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [categoryId, setCategoryId] = useState<number | ''>(defaultCategoryId || '');
    const [assignedTo, setAssignedTo] = useState<number | ''>('');
    const [dueDate, setDueDate] = useState('');
    const [points, setPoints] = useState(1);

    const [editing, setEditing] = useState<null | 'priority' | 'category' | 'assignee' | 'due' | 'points'>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const titleRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => { titleRef.current?.focus(); }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setError('');
        const data: Record<string, unknown> = {
            title: title.trim(),
            description: description || undefined,
            priority,
            points,
            is_recurring: false,
        };
        if (categoryId) data.category = Number(categoryId);
        if (assignedTo) data.assigned_to = Number(assignedTo);
        if (dueDate) data.due_date = new Date(dueDate).toISOString();
        startTransition(async () => {
            try {
                const { createTask } = await import('@/app/actions/workspace');
                const result = await createTask(data);
                if (result?.id) onSuccess(result);
                else setError('Failed to create task');
            } catch { setError('Failed to create task'); }
        });
    }

    const priorityMeta = PRIORITIES.find(p => p.key === priority) ?? PRIORITIES[1];
    const assignedUser = assignedTo ? users.find(u => u.id === Number(assignedTo)) : null;
    const categoryMeta = categoryId ? categories.find(c => c.id === Number(categoryId)) : null;
    const getName = (u: UserItem) => u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.email || u.username);

    const fieldBtn = (label: React.ReactNode, color: string, active: boolean, onClick: () => void) => (
        <button type="button" onClick={onClick}
                className="flex items-center gap-1 text-tp-xs font-bold transition-all"
                style={{ color: active ? color : 'var(--app-muted-foreground)' }}>
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 55%, transparent)', backdropFilter: 'blur(10px)' }}
             onClick={onClose}>
            <div className="w-full max-w-2xl rounded-3xl shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                        Preview of your task card
                    </span>
                    <button type="button" onClick={onClose}
                            className="p-1.5 rounded-full transition-all hover:bg-app-bg/60"
                            style={{ color: 'var(--app-muted-foreground)' }}>
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

                    {/* The card — looks EXACTLY like a TaskCard list row */}
                    <div className="group rounded-xl p-4 transition-all"
                         style={{
                             background: 'var(--app-bg)',
                             border: '1px solid var(--app-border)',
                             borderLeft: `3px solid ${priorityMeta.color}`,
                         }}>
                        <div className="flex items-start justify-between mb-2 gap-3">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                     style={{ background: `color-mix(in srgb, ${priorityMeta.color} 10%, transparent)`, color: priorityMeta.color }}>
                                    <Clock size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <input ref={titleRef} type="text" value={title} onChange={e => setTitle(e.target.value)} required
                                           placeholder="Title your task…"
                                           className="w-full bg-transparent outline-none text-tp-lg font-bold placeholder:opacity-40"
                                           style={{ color: 'var(--app-foreground)' }} />
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                           placeholder="Add description"
                                           className="w-full mt-0.5 bg-transparent outline-none text-tp-sm font-medium placeholder:opacity-40"
                                           style={{ color: 'var(--app-muted-foreground)' }} />
                                </div>
                            </div>
                            <button type="button" onClick={() => setEditing(editing === 'priority' ? null : 'priority')}
                                    className="text-tp-xxs font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                    style={{
                                        background: `color-mix(in srgb, ${priorityMeta.color} 10%, transparent)`,
                                        color: priorityMeta.color,
                                        border: `1px solid color-mix(in srgb, ${priorityMeta.color} 25%, transparent)`,
                                    }}>
                                {priorityMeta.label}
                            </button>
                        </div>

                        <div className="flex items-center gap-3 text-tp-sm font-medium flex-wrap"
                             style={{ color: 'var(--app-muted-foreground)' }}>
                            {fieldBtn(
                                <><FolderKanban size={10} /> {categoryMeta?.name || 'Category'}</>,
                                'var(--app-primary)', !!categoryMeta,
                                () => setEditing(editing === 'category' ? null : 'category')
                            )}
                            {fieldBtn(
                                <><Calendar size={10} /> {dueDate ? formatDue(dueDate) : 'Due date'}</>,
                                'var(--app-primary)', !!dueDate,
                                () => setEditing(editing === 'due' ? null : 'due')
                            )}
                            {fieldBtn(
                                <><UserIcon size={10} /> {assignedUser ? getName(assignedUser) : 'Assignee'}</>,
                                'var(--app-info, #3b82f6)', !!assignedUser,
                                () => setEditing(editing === 'assignee' ? null : 'assignee')
                            )}
                            {fieldBtn(
                                <><Star size={10} /> {points} pt{points === 1 ? '' : 's'}</>,
                                'var(--app-warning, #f59e0b)', true,
                                () => setEditing(editing === 'points' ? null : 'points')
                            )}
                        </div>
                    </div>

                    {/* Inline editors — appear directly below the card */}
                    {editing === 'priority' && (
                        <div className="p-3 rounded-2xl grid grid-cols-4 gap-2"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {PRIORITIES.map(p => (
                                <button key={p.key} type="button"
                                        onClick={() => { setPriority(p.key); setEditing(null); }}
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

                    {editing === 'category' && (
                        <div className="p-2 rounded-2xl max-h-52 overflow-y-auto"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <button type="button" onClick={() => { setCategoryId(''); setEditing(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left"
                                    style={{ color: !categoryId ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                <FolderKanban size={13} /> No category
                                {!categoryId && <Check size={13} className="ml-auto" />}
                            </button>
                            {categories.map(c => (
                                <button key={c.id} type="button"
                                        onClick={() => { setCategoryId(c.id); setEditing(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left"
                                        style={{ color: Number(categoryId) === c.id ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || 'var(--app-primary)' }} />
                                    <span className="truncate">{c.name}</span>
                                    {Number(categoryId) === c.id && <Check size={13} className="ml-auto" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {editing === 'due' && (
                        <div className="p-3 rounded-2xl space-y-2"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="flex flex-wrap gap-1.5">
                                {([
                                    { label: 'Today', days: 0 },
                                    { label: 'Tomorrow', days: 1 },
                                    { label: 'Next week', days: 7 },
                                ] as const).map(opt => (
                                    <button key={opt.label} type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + opt.days);
                                                d.setHours(17, 0, 0, 0);
                                                setDueDate(d.toISOString().slice(0, 16));
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-tp-xs font-bold"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        {opt.label}
                                    </button>
                                ))}
                                {dueDate && (
                                    <button type="button" onClick={() => setDueDate('')}
                                            className="px-2.5 py-1 rounded-lg text-tp-xs font-bold"
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

                    {editing === 'assignee' && (
                        <div className="p-2 rounded-2xl max-h-52 overflow-y-auto"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <button type="button" onClick={() => { setAssignedTo(''); setEditing(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left"
                                    style={{ color: !assignedTo ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                <UserIcon size={13} /> Unassigned
                                {!assignedTo && <Check size={13} className="ml-auto" />}
                            </button>
                            {users.map(u => (
                                <button key={u.id} type="button"
                                        onClick={() => { setAssignedTo(u.id); setEditing(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-tp-sm font-bold text-left"
                                        style={{ color: Number(assignedTo) === u.id ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-tp-xs font-black flex-shrink-0"
                                         style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                        {getName(u).charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{getName(u)}</span>
                                    {Number(assignedTo) === u.id && <Check size={13} className="ml-auto" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {editing === 'points' && (
                        <div className="p-3 rounded-2xl flex items-center gap-2 flex-wrap"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {[1, 2, 3, 5, 8, 13].map(n => (
                                <button key={n} type="button"
                                        onClick={() => { setPoints(n); setEditing(null); }}
                                        className="w-10 h-10 rounded-xl text-tp-md font-black"
                                        style={{
                                            background: points === n ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' : 'var(--app-surface)',
                                            border: `1px solid ${points === n ? 'color-mix(in srgb, var(--app-warning) 40%, transparent)' : 'var(--app-border)'}`,
                                            color: points === n ? 'var(--app-warning, #f59e0b)' : 'var(--app-foreground)',
                                        }}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1" />
                        <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-tp-sm font-bold rounded-xl"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending || !title.trim()}
                                className="px-5 py-2.5 text-tp-sm font-black text-white rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                            {isPending ? 'Creating…' : 'Create task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
