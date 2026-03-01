'use client';

import { POSLayoutVariant } from '@/types/pos-layout';
import { Layout, X, Monitor, Zap, ShoppingCart, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const LAYOUTS: { id: POSLayoutVariant; name: string; description: string; icon: any; preview: string; accent: string }[] = [
    {
        id: 'classic',
        name: 'Standard Node',
        description: 'Odoo-inspired orchestration. Products left, order panel right. Familiar reliability.',
        icon: Monitor,
        preview: '🛒 Node Alpha: Classic Split',
        accent: 'slate',
    },
    {
        id: 'modern',
        name: 'Intelligence Canvas',
        description: 'Cart-primary interface. Full visibility on operational throughput. High-fidelity visuals.',
        icon: ShoppingCart,
        preview: '📦 Intelligence Flow: Expansive Cart',
        accent: 'emerald',
    },
    {
        id: 'compact',
        name: 'High-Velocity Terminal',
        description: 'Low-latency dark console. Monospace precision, optimized for max transactional throughput.',
        icon: Zap,
        preview: '⚡ Speed Protocol: Dense Matrix',
        accent: 'amber',
    },
    {
        id: 'original',
        name: 'Original Modern',
        description: 'The original clean cart-focused layout. Categories & payment left, full cart view right. Lightweight & fast.',
        icon: Sparkles,
        preview: '✨ Classic Modern: Clean Cart Focus',
        accent: 'violet',
    },
];

const accentMap: Record<string, { bg: string; border: string; text: string; ring: string; glow: string; iconBg: string }> = {
    slate: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', ring: 'ring-slate-100', glow: 'shadow-slate-100', iconBg: 'bg-slate-900 text-white' },
    emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-100', glow: 'shadow-emerald-100', iconBg: 'bg-emerald-gradient text-white' },
    amber: { bg: 'bg-amber-50/50', border: 'border-amber-500', text: 'text-amber-700', ring: 'ring-amber-100', glow: 'shadow-amber-100', iconBg: 'bg-amber-gradient text-white' },
    violet: { bg: 'bg-violet-50/50', border: 'border-violet-500', text: 'text-violet-700', ring: 'ring-violet-100', glow: 'shadow-violet-100', iconBg: 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white' },
};

export function POSLayoutSelector({
    isOpen,
    currentLayout,
    onSelect,
    onClose,
}: {
    isOpen: boolean;
    currentLayout: POSLayoutVariant;
    onSelect: (layout: POSLayoutVariant) => void;
    onClose: () => void;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-white rounded-[3rem] shadow-2xl w-[720px] max-h-[90vh] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

                {/* Header */}
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Layout size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tighter">Interface Configuration</h2>
                            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Select the operational visualization node</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all border border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Layout Cards */}
                <div className="p-10 space-y-5">
                    {LAYOUTS.map(layout => {
                        const isActive = currentLayout === layout.id;
                        const accent = accentMap[layout.accent];
                        const Icon = layout.icon;

                        return (
                            <button
                                key={layout.id}
                                onClick={() => {
                                    onSelect(layout.id);
                                    onClose();
                                }}
                                className={clsx(
                                    "w-full p-6 rounded-[2rem] border-2 text-left transition-all hover:shadow-2xl hover:-translate-y-1 group relative overflow-hidden",
                                    isActive
                                        ? `${accent.bg} ${accent.border} shadow-xl ${accent.glow}`
                                        : "bg-white border-slate-100 hover:border-emerald-200"
                                )}
                            >
                                {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16" />}

                                <div className="flex items-start gap-6 relative z-10">
                                    <div className={clsx(
                                        "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                                        isActive ? `${accent.iconBg} rotate-6 shadow-lg shadow-current/20` : "bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"
                                    )}>
                                        <Icon size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className={clsx(
                                                "text-[15px] font-black uppercase tracking-tight",
                                                isActive ? accent.text : "text-slate-800"
                                            )}>
                                                {layout.name}
                                            </h3>
                                            {isActive && (
                                                <span className="bg-emerald-gradient text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                                                    Active Hub
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[12px] text-slate-500 mt-2 leading-relaxed font-bold">{layout.description}</p>
                                        <div className="mt-4 px-4 py-2 bg-slate-900 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-2 border border-slate-800">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            {layout.preview}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-10 py-6 border-t border-slate-50 bg-slate-50/30">
                    <p className="text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">
                        System configuration synced with local persistence engine.
                    </p>
                </div>
            </div>
        </div>
    );
}
