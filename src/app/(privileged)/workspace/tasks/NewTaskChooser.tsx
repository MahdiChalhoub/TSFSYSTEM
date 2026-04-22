'use client';

/**
 * NewTaskChooser — picks one of 4 creation philosophies
 * =====================================================
 * Philosophy A: Smart Draft — type naturally, auto-parse
 * Philosophy B: From Recipe — retail/ops templates
 * Philosophy C: Card = Form — WYSIWYG editor
 * Philosophy D: Classic Form — the full TaskModal with every knob
 *
 * The user's last choice is remembered in localStorage so they can skip the
 * chooser next time with "Use last" (honoured after first pick).
 */

import { useState, useEffect } from 'react';
import {
    X, Sparkles, LayoutGrid, SquarePen, Settings2, ArrowRight, Check,
} from 'lucide-react';
import type { Category, UserItem } from './types';
import TaskModal from './TaskModal';
import TaskModalSmartDraft from './TaskModalSmartDraft';
import TaskModalRecipe from './TaskModalRecipe';
import TaskModalCard from './TaskModalCard';

type Variant = 'draft' | 'recipe' | 'card' | 'classic';

interface Props {
    categories: Category[];
    users: UserItem[];
    defaultCategoryId?: number;
    onClose: () => void;
    onSuccess: (result: any) => void;
}

const LS_KEY = 'tasks.newTaskVariant';

const CHOICES: { key: Variant; title: string; subtitle: string; Icon: React.ComponentType<{ size?: number }>; color: string }[] = [
    {
        key: 'draft',
        title: 'Smart Draft',
        subtitle: 'Type naturally. "by Friday @maria !urgent" auto-parses into fields.',
        Icon: Sparkles,
        color: 'var(--app-primary)',
    },
    {
        key: 'recipe',
        title: 'From Recipe',
        subtitle: 'Pick a retail template (cash count, restock, handover…). Pre-filled for you.',
        Icon: LayoutGrid,
        color: 'var(--app-success, #22c55e)',
    },
    {
        key: 'card',
        title: 'Card = Form',
        subtitle: 'Edit the task card directly, WYSIWYG. What you type is what appears.',
        Icon: SquarePen,
        color: 'var(--app-info, #3b82f6)',
    },
    {
        key: 'classic',
        title: 'Classic Form',
        subtitle: 'Full form with every option — recurring, proof-of-work, checklist.',
        Icon: Settings2,
        color: 'var(--app-muted-foreground)',
    },
];

export default function NewTaskChooser(props: Props) {
    const [variant, setVariant] = useState<Variant | null>(null);
    const [lastUsed, setLastUsed] = useState<Variant | null>(null);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LS_KEY) as Variant | null;
            if (saved && ['draft', 'recipe', 'card', 'classic'].includes(saved)) {
                setLastUsed(saved);
            }
        } catch {}
    }, []);

    function choose(v: Variant) {
        try { localStorage.setItem(LS_KEY, v); } catch {}
        setVariant(v);
    }

    // Once a variant is picked, render the corresponding modal. onClose goes
    // through to the parent — cancelling a variant closes the whole flow.
    if (variant === 'draft') return <TaskModalSmartDraft {...props} />;
    if (variant === 'recipe') return <TaskModalRecipe {...props} />;
    if (variant === 'card') return <TaskModalCard {...props} />;
    if (variant === 'classic') return <TaskModal {...props} />;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 55%, transparent)', backdropFilter: 'blur(10px)' }}
             onClick={props.onClose}>
            <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                 onClick={e => e.stopPropagation()}>

                <div className="sticky top-0 z-10 px-5 pt-4 pb-3 flex items-center justify-between"
                     style={{ background: 'var(--app-surface)' }}>
                    <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                        How do you want to create this task?
                    </span>
                    <button type="button" onClick={props.onClose}
                            className="p-1.5 rounded-full transition-all hover:bg-app-bg/60"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 pb-5 space-y-2">
                    <p className="text-tp-sm mb-3" style={{ color: 'var(--app-muted-foreground)' }}>
                        Four creation styles — try each to see which feels best.
                    </p>

                    {CHOICES.map(c => {
                        const wasLast = lastUsed === c.key;
                        return (
                            <button key={c.key} type="button" onClick={() => choose(c.key)}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:-translate-y-0.5"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                     style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)`, color: c.color }}>
                                    <c.Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-tp-md font-black" style={{ color: 'var(--app-foreground)' }}>
                                            {c.title}
                                        </span>
                                        {wasLast && (
                                            <span className="text-tp-xxs font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                                  style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                                <Check size={9} /> last used
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-tp-xs leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {c.subtitle}
                                    </div>
                                </div>
                                <ArrowRight size={14} style={{ color: 'var(--app-muted-foreground)' }} className="flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
