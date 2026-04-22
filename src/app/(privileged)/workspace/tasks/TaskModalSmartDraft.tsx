'use client';

/**
 * Smart Draft — natural-language task creation (Variant A)
 * =========================================================
 * One input. Type like you'd tell a coworker:
 *
 *     "Daily cash count by Friday 6pm @maria !urgent #store-ops"
 *
 * Live preview strip underneath shows what the parser understood. Each parsed
 * token is a chip — click a chip to edit or remove. Unrecognised words stay
 * in the title.
 *
 * Parser grammar (deliberately small, predictable):
 *   @name           → assignee (matches on first/last/username/email prefix)
 *   #tag            → category (matches category name; first match wins)
 *   !priority       → !urgent/!high/!med/!low  (short forms ok)
 *   by <date>       → due date: "by today", "by tomorrow", "by Friday",
 *                                "by next week", "by 6pm", "by 17:00",
 *                                "by 2025-12-15"
 *   *N              → points (e.g. *3, *8)
 *   Everything else → title
 *
 * The parser is pure (no side-effects), so we can re-run it on every keystroke
 * and show the user what'll get saved.
 */

import { useState, useMemo, useRef, useEffect, useTransition } from 'react';
import { X, Flag, Calendar, User as UserIcon, FolderKanban, Star, Sparkles } from 'lucide-react';
import type { Category, UserItem } from './types';

interface Props {
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
}

type Parsed = {
    title: string;
    priority: string;
    assignee: UserItem | null;
    category: Category | null;
    dueDate: Date | null;
    points: number;
};

const PRIORITY_SHORT: Record<string, string> = {
    urgent: 'URGENT', u: 'URGENT',
    high: 'HIGH', h: 'HIGH',
    medium: 'MEDIUM', med: 'MEDIUM', m: 'MEDIUM',
    low: 'LOW', l: 'LOW',
};

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Parse "by …" phrases. Returns [Date, charsConsumedAfterBy] or null. */
function parseByPhrase(words: string[], startIdx: number): { date: Date; consumed: number } | null {
    const now = new Date();
    const phrase = words.slice(startIdx, startIdx + 4).map(w => w.toLowerCase()).join(' ');
    // "by today"
    if (/^today\b/.test(phrase)) return { date: endOfDay(now), consumed: 1 };
    // "by tomorrow"
    if (/^tomorrow\b/.test(phrase)) { const d = new Date(now); d.setDate(d.getDate() + 1); return { date: endOfDay(d), consumed: 1 }; }
    // "by next week"
    if (/^next week\b/.test(phrase)) { const d = new Date(now); d.setDate(d.getDate() + 7); return { date: endOfDay(d), consumed: 2 }; }
    // "by <weekday>"
    for (let i = 0; i < 7; i++) {
        if (phrase.startsWith(WEEKDAYS[i])) {
            const d = new Date(now);
            const delta = ((i - d.getDay() + 7) % 7) || 7;
            d.setDate(d.getDate() + delta);
            return { date: endOfDay(d), consumed: 1 };
        }
    }
    // "by 2025-12-15" or "by 12/15" or "by 6pm" / "by 17:00"
    const first = (words[startIdx] || '').toLowerCase();
    const timeMatch = first.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
    if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3]?.toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
            const d = new Date(now);
            d.setHours(h, m, 0, 0);
            // If the time already passed today, assume tomorrow
            if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
            return { date: d, consumed: 1 };
        }
    }
    const isoMatch = first.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3], 17, 0, 0, 0);
        return { date: d, consumed: 1 };
    }
    return null;
}

function endOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(17, 0, 0, 0);
    return out;
}

function nameMatches(u: UserItem, needle: string): boolean {
    const n = needle.toLowerCase();
    const first = (u.first_name || '').toLowerCase();
    const last = (u.last_name || '').toLowerCase();
    const uname = (u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase().split('@')[0];
    return first.startsWith(n) || last.startsWith(n) || uname.startsWith(n) || email.startsWith(n)
        || `${first}${last}`.startsWith(n) || `${first} ${last}` === n;
}

function parseDraft(raw: string, users: UserItem[], categories: Category[], defaultCategoryId?: number): Parsed {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    const titleBits: string[] = [];
    let priority = 'MEDIUM';
    let assignee: UserItem | null = null;
    let category: Category | null = defaultCategoryId ? categories.find(c => c.id === defaultCategoryId) || null : null;
    let dueDate: Date | null = null;
    let points = 1;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        // @assignee
        if (w.startsWith('@') && w.length > 1) {
            const needle = w.slice(1);
            const hit = users.find(u => nameMatches(u, needle));
            if (hit) { assignee = hit; continue; }
        }
        // #category
        if (w.startsWith('#') && w.length > 1) {
            const needle = w.slice(1).toLowerCase().replace(/-/g, ' ');
            const hit = categories.find(c => c.name.toLowerCase().includes(needle));
            if (hit) { category = hit; continue; }
        }
        // !priority
        if (w.startsWith('!') && w.length > 1) {
            const key = w.slice(1).toLowerCase();
            if (PRIORITY_SHORT[key]) { priority = PRIORITY_SHORT[key]; continue; }
        }
        // *N points
        if (w.startsWith('*') && /^\*\d+$/.test(w)) {
            const n = parseInt(w.slice(1), 10);
            if (n > 0 && n < 100) { points = n; continue; }
        }
        // "by …"
        if (w.toLowerCase() === 'by' && i + 1 < words.length) {
            const res = parseByPhrase(words, i + 1);
            if (res) { dueDate = res.date; i += res.consumed; continue; }
        }
        titleBits.push(w);
    }

    return { title: titleBits.join(' '), priority, assignee, category, dueDate, points };
}

function formatDue(d: Date): string {
    const now = new Date();
    const diffDays = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
    const hhmm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 0) return `Today · ${hhmm}`;
    if (diffDays === 1) return `Tomorrow · ${hhmm}`;
    if (diffDays >= 2 && diffDays < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} · ${hhmm}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TaskModalSmartDraft({ categories, users, defaultCategoryId, onClose, onSuccess }: Props) {
    const [draft, setDraft] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const parsed = useMemo(() => parseDraft(draft, users, categories, defaultCategoryId), [draft, users, categories, defaultCategoryId]);

    function autosize(el: HTMLTextAreaElement | null) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 240) + 'px';
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!parsed.title.trim()) return;
        setError('');
        const data: Record<string, unknown> = {
            title: parsed.title.trim(),
            priority: parsed.priority,
            points: parsed.points,
            is_recurring: false,
        };
        if (parsed.category) data.category = parsed.category.id;
        if (parsed.assignee) data.assigned_to = parsed.assignee.id;
        if (parsed.dueDate) data.due_date = parsed.dueDate.toISOString();
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
            <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                <div className="sticky top-0 z-10 px-5 pt-4 pb-3 flex items-center justify-between"
                     style={{ background: 'var(--app-surface)' }}>
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                            Smart draft
                        </span>
                    </div>
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

                    <textarea ref={inputRef} value={draft} rows={2}
                              onChange={e => { setDraft(e.target.value); autosize(e.target); }}
                              onInput={e => autosize(e.currentTarget)}
                              placeholder="Daily cash count by Friday 6pm @maria !urgent #store-ops"
                              className="w-full resize-none outline-none bg-transparent text-xl md:text-2xl font-bold leading-relaxed placeholder:opacity-40"
                              style={{ color: 'var(--app-foreground)' }} />

                    {/* Parsed preview — always visible so users learn the grammar */}
                    <div className="flex flex-wrap gap-2">
                        {/* Title preview */}
                        <span className="px-3 py-1.5 rounded-full text-tp-sm font-bold"
                              style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)', color: 'var(--app-foreground)', border: '1px dashed var(--app-border)' }}>
                            {parsed.title || <span style={{ opacity: 0.45 }}>Title…</span>}
                        </span>
                        {/* Priority */}
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold"
                              style={{ background: `color-mix(in srgb, ${PRIORITY_COLOR[parsed.priority]} 10%, transparent)`, color: PRIORITY_COLOR[parsed.priority], border: `1px solid color-mix(in srgb, ${PRIORITY_COLOR[parsed.priority]} 30%, transparent)` }}>
                            <Flag size={11} /> {parsed.priority[0] + parsed.priority.slice(1).toLowerCase()}
                        </span>
                        {/* Due date */}
                        {parsed.dueDate && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold"
                                  style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                <Calendar size={11} /> {formatDue(parsed.dueDate)}
                            </span>
                        )}
                        {/* Assignee */}
                        {parsed.assignee && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold"
                                  style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' }}>
                                <UserIcon size={11} /> {getName(parsed.assignee)}
                            </span>
                        )}
                        {/* Category */}
                        {parsed.category && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold"
                                  style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}>
                                <FolderKanban size={11} /> {parsed.category.name}
                            </span>
                        )}
                        {/* Points */}
                        {parsed.points !== 1 && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tp-sm font-bold"
                                  style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                <Star size={11} /> {parsed.points} pts
                            </span>
                        )}
                    </div>

                    {/* Cheatsheet */}
                    <div className="px-3 py-2.5 rounded-xl text-tp-xs space-y-1"
                         style={{ background: 'var(--app-bg)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <div><code>@name</code> = assignee · <code>#tag</code> = category · <code>!urgent/!high/!med/!low</code> = priority</div>
                        <div><code>by today</code> / <code>by tomorrow</code> / <code>by friday</code> / <code>by 6pm</code> / <code>by 2025-12-15</code> · <code>*3</code> = points</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1" />
                        <button type="button" onClick={onClose}
                                className="px-4 py-2.5 text-tp-sm font-bold rounded-xl"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending || !parsed.title.trim()}
                                className="px-5 py-2.5 text-tp-sm font-black text-white rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                            {isPending ? 'Creating…' : 'Create task ⏎'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
