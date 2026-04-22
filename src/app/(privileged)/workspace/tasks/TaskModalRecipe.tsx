'use client';

/**
 * Start-from-Recipe (Variant B)
 * ==============================
 * Retail/ops-shaped templates are the entry point. Pick one and it's
 * pre-filled. "Blank" goes to the classic form. No empty-field paralysis.
 *
 * The recipes here are hard-coded on purpose: they're part of the onboarding
 * experience, not user data. Long-term they can migrate to the backend's
 * TaskTemplate model, but the philosophy only works if the first screen is
 * fast and opinionated — no "load templates from API" spinner.
 */

import { useState, useTransition } from 'react';
import {
    X, ArrowLeft, Coins, Package, AlertCircle, UserCheck, Truck, FileText,
    ClipboardCheck, Wrench, Flag, Calendar, User as UserIcon, Check,
} from 'lucide-react';
import type { Category, UserItem } from './types';

interface Props {
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
}

type Recipe = {
    id: string;
    title: string;
    description: string;
    priority: string;
    points: number;
    categoryHint?: string;
    checklist?: string[];
    requireProof?: boolean;
    tintColor: string;
    Icon: React.ComponentType<{ size?: number }>;
};

const RECIPES: Recipe[] = [
    {
        id: 'cash-count',
        title: 'Daily cash count',
        description: 'Reconcile register cash against system total before end of shift.',
        priority: 'HIGH', points: 3, categoryHint: 'cash',
        checklist: ['Counted cash drawer', 'Reconciled with POS', 'Logged variance (if any)', 'Signed by manager'],
        requireProof: true,
        tintColor: 'var(--app-warning, #f59e0b)',
        Icon: Coins,
    },
    {
        id: 'restock',
        title: 'Restock check',
        description: 'Walk the floor and flag low-stock items for reorder.',
        priority: 'MEDIUM', points: 2, categoryHint: 'stock',
        checklist: ['Inspected all aisles', 'Listed items below par', 'Placed reorder'],
        tintColor: 'var(--app-info, #3b82f6)',
        Icon: Package,
    },
    {
        id: 'complaint',
        title: 'Customer complaint',
        description: 'Log and resolve a customer issue.',
        priority: 'URGENT', points: 3, categoryHint: 'customer',
        checklist: ['Spoke with customer', 'Identified root cause', 'Offered resolution', 'Recorded outcome'],
        requireProof: true,
        tintColor: 'var(--app-error, #ef4444)',
        Icon: AlertCircle,
    },
    {
        id: 'handover',
        title: 'Shift handover',
        description: 'Brief the next shift on open items, incidents, and priorities.',
        priority: 'HIGH', points: 2, categoryHint: 'shift',
        checklist: ['Summarised open tasks', 'Noted incidents', 'Confirmed tomorrow\'s priorities'],
        tintColor: 'var(--app-primary)',
        Icon: UserCheck,
    },
    {
        id: 'delivery',
        title: 'Supplier delivery',
        description: 'Receive and verify an inbound delivery against the PO.',
        priority: 'HIGH', points: 3, categoryHint: 'supplier',
        checklist: ['Inspected packaging', 'Matched qty vs PO', 'Flagged damages', 'Stored stock'],
        requireProof: true,
        tintColor: 'var(--app-success, #22c55e)',
        Icon: Truck,
    },
    {
        id: 'incident',
        title: 'Incident report',
        description: 'Record a safety, security, or operational incident.',
        priority: 'URGENT', points: 3, categoryHint: 'incident',
        checklist: ['Described incident', 'Noted time & location', 'Listed people involved', 'Attached evidence'],
        requireProof: true,
        tintColor: 'var(--app-error, #ef4444)',
        Icon: FileText,
    },
    {
        id: 'audit',
        title: 'Quick audit',
        description: 'Light-touch check of cleanliness, signage, and compliance.',
        priority: 'MEDIUM', points: 2, categoryHint: 'audit',
        checklist: ['Cleanliness OK', 'Signage correct', 'No safety hazards', 'Logged any issues'],
        tintColor: 'var(--app-info, #3b82f6)',
        Icon: ClipboardCheck,
    },
    {
        id: 'maintenance',
        title: 'Equipment maintenance',
        description: 'Inspect or service in-store equipment.',
        priority: 'MEDIUM', points: 3, categoryHint: 'maintenance',
        checklist: ['Inspected equipment', 'Logged readings', 'Reported issues'],
        tintColor: 'var(--app-muted-foreground)',
        Icon: Wrench,
    },
];

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
};

export default function TaskModalRecipe({ categories, users, defaultCategoryId, onClose, onSuccess }: Props) {
    const [stage, setStage] = useState<'pick' | 'customize'>('pick');
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [title, setTitle] = useState('');
    const [assignedTo, setAssignedTo] = useState<number | ''>('');
    const [dueDate, setDueDate] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    function pickRecipe(r: Recipe) {
        setRecipe(r);
        setTitle(r.title);
        // Auto-assign tomorrow 5pm as a sensible default
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(17, 0, 0, 0);
        setDueDate(d.toISOString().slice(0, 16));
        setStage('customize');
    }

    // Attempt to match the recipe's categoryHint to an existing user category.
    function resolveCategoryId(r: Recipe): number | null {
        if (defaultCategoryId) return defaultCategoryId;
        if (!r.categoryHint) return null;
        const needle = r.categoryHint.toLowerCase();
        const hit = categories.find(c => c.name.toLowerCase().includes(needle));
        return hit?.id ?? null;
    }

    async function handleSubmit() {
        if (!recipe || !title.trim()) return;
        setError('');
        const data: Record<string, unknown> = {
            title: title.trim(),
            description: recipe.description,
            priority: recipe.priority,
            points: recipe.points,
            is_recurring: false,
            require_completion_note: !!recipe.requireProof,
            completion_checklist: (recipe.checklist || []).map(label => ({ label, checked: false })),
        };
        const catId = resolveCategoryId(recipe);
        if (catId) data.category = catId;
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

    const getName = (u: UserItem) => u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.email || u.username);

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 55%, transparent)', backdropFilter: 'blur(10px)' }}
             onClick={onClose}>
            <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                <div className="sticky top-0 z-10 px-5 pt-4 pb-3 flex items-center justify-between"
                     style={{ background: 'var(--app-surface)' }}>
                    <div className="flex items-center gap-2">
                        {stage === 'customize' && (
                            <button type="button" onClick={() => setStage('pick')}
                                    className="p-1.5 rounded-full transition-all hover:bg-app-bg/60"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                <ArrowLeft size={14} />
                            </button>
                        )}
                        <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                            {stage === 'pick' ? 'Start from a recipe' : 'Customize'}
                        </span>
                    </div>
                    <button type="button" onClick={onClose}
                            className="p-1.5 rounded-full transition-all hover:bg-app-bg/60"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {stage === 'pick' && (
                    <div className="px-5 pb-5 space-y-4">
                        <p className="text-tp-md" style={{ color: 'var(--app-muted-foreground)' }}>
                            Pick the kind of work you're creating. We'll pre-fill the details for you.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            {RECIPES.map(r => (
                                <button key={r.id} type="button" onClick={() => pickRecipe(r)}
                                        className="text-left p-4 rounded-2xl transition-all hover:-translate-y-0.5"
                                        style={{ background: 'var(--app-bg)', border: `1px solid var(--app-border)` }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                         style={{ background: `color-mix(in srgb, ${r.tintColor} 12%, transparent)`, color: r.tintColor }}>
                                        <r.Icon size={18} />
                                    </div>
                                    <div className="text-tp-md font-black mb-1" style={{ color: 'var(--app-foreground)' }}>
                                        {r.title}
                                    </div>
                                    <div className="text-tp-xs leading-relaxed mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {r.description}
                                    </div>
                                    <div className="flex items-center gap-2 text-tp-xxs">
                                        <span className="font-black uppercase tracking-wider" style={{ color: PRIORITY_COLOR[r.priority] }}>
                                            {r.priority[0] + r.priority.slice(1).toLowerCase()}
                                        </span>
                                        <span style={{ color: 'var(--app-muted-foreground)' }}>·</span>
                                        <span style={{ color: 'var(--app-muted-foreground)' }}>{r.points} pts</span>
                                        {r.checklist && <>
                                            <span style={{ color: 'var(--app-muted-foreground)' }}>·</span>
                                            <span style={{ color: 'var(--app-muted-foreground)' }}>{r.checklist.length} steps</span>
                                        </>}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="pt-2 text-center">
                            <button type="button"
                                    onClick={() => { setRecipe({
                                        id: 'blank', title: '', description: '', priority: 'MEDIUM', points: 1,
                                        tintColor: 'var(--app-muted-foreground)', Icon: FileText,
                                    }); setTitle(''); setStage('customize'); }}
                                    className="text-tp-sm font-bold underline"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                Or start blank →
                            </button>
                        </div>
                    </div>
                )}

                {stage === 'customize' && recipe && (
                    <div className="px-5 pb-5 space-y-4">
                        {error && (
                            <div className="px-3 py-2 rounded-xl text-tp-sm font-bold"
                                 style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                                {error}
                            </div>
                        )}

                        {/* Chosen recipe banner */}
                        <div className="flex items-center gap-3 p-3 rounded-2xl"
                             style={{ background: `color-mix(in srgb, ${recipe.tintColor} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${recipe.tintColor} 25%, transparent)` }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                 style={{ background: `color-mix(in srgb, ${recipe.tintColor} 14%, transparent)`, color: recipe.tintColor }}>
                                <recipe.Icon size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-tp-sm font-black" style={{ color: 'var(--app-foreground)' }}>{recipe.title || 'Blank task'}</div>
                                <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <Flag size={10} className="inline mr-1" style={{ color: PRIORITY_COLOR[recipe.priority] }} />
                                    {recipe.priority[0] + recipe.priority.slice(1).toLowerCase()} · {recipe.points} pts
                                    {recipe.checklist && ` · ${recipe.checklist.length}-step checklist`}
                                    {recipe.requireProof && ' · proof required'}
                                </div>
                            </div>
                        </div>

                        {/* Title (editable) */}
                        <div>
                            <label className="text-tp-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                Title
                            </label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                                   className="w-full text-tp-lg font-bold px-3 py-2.5 rounded-xl outline-none"
                                   style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                   placeholder="Task title" />
                        </div>

                        {/* Due + Assignee — the two things the recipe CAN'T infer */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-tp-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <Calendar size={11} className="inline mb-0.5 mr-1" /> Due
                                </label>
                                <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                       className="w-full text-tp-md font-bold px-3 py-2.5 rounded-xl outline-none"
                                       style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                            <div>
                                <label className="text-tp-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <UserIcon size={11} className="inline mb-0.5 mr-1" /> Assign to
                                </label>
                                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value ? parseInt(e.target.value) : '')}
                                        className="w-full text-tp-md font-bold px-3 py-2.5 rounded-xl outline-none"
                                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">Unassigned</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{getName(u)}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Preview of what will be created */}
                        {recipe.checklist && recipe.checklist.length > 0 && (
                            <div className="p-3 rounded-2xl"
                                 style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-tp-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Checklist the assignee will see
                                </div>
                                <div className="space-y-1">
                                    {recipe.checklist.map((step, i) => (
                                        <div key={i} className="flex items-start gap-2 text-tp-sm" style={{ color: 'var(--app-foreground)' }}>
                                            <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>☐</span>
                                            <span>{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <div className="flex-1" />
                            <button type="button" onClick={onClose}
                                    className="px-4 py-2.5 text-tp-sm font-bold rounded-xl"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleSubmit} disabled={isPending || !title.trim()}
                                    className="px-5 py-2.5 text-tp-sm font-black text-white rounded-xl transition-all disabled:opacity-50"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                                {isPending ? 'Creating…' : 'Create task'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
