'use client';

import { useState, useTransition } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Task, Category, UserItem } from './types';

interface TaskModalProps {
    task?: Task | null;
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
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

    const inputCls = 'w-full text-tp-lg font-bold px-3 py-2.5 rounded-xl outline-none transition-all';
    const inputStyle = { background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' };
    const labelCls = 'text-tp-xs font-bold uppercase tracking-wide mb-1.5 block';
    const labelStyle = { color: 'var(--app-muted-foreground)' };

    const getUserDisplayName = (u: UserItem) =>
        u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.username;

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
                    <h2 className="text-base font-bold" style={{ color: 'var(--app-foreground)' }}>
                        {isEdit ? 'Edit Task' : 'Create New Task'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-70"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="px-3 py-2 rounded-xl text-tp-md font-bold"
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
                                    className={inputCls} style={inputStyle} disabled={!isEdit}>
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
                                <option key={u.id} value={u.id}>{getUserDisplayName(u)}</option>
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
                            <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
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
                                    className="flex items-center gap-1 px-3 py-2 text-tp-sm font-bold rounded-xl transition-colors disabled:opacity-50 border"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                                <Trash2 size={13} /> Delete
                            </button>
                        )}
                        <div className="flex-1" />
                        <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-tp-sm font-bold rounded-xl transition-colors border"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending}
                                className="px-5 py-2.5 text-tp-sm font-bold text-white rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
