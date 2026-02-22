'use client';

import { POSLayoutVariant } from '@/types/pos-layout';
import { Layout, X, Monitor, Zap, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';

const LAYOUTS: { id: POSLayoutVariant; name: string; description: string; icon: any; preview: string; accent: string }[] = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'Odoo-inspired layout. Products left, order panel right with numpad. Clean and familiar.',
        icon: Monitor,
        preview: '🛒 Products ← | → Order + Numpad',
        accent: 'indigo',
    },
    {
        id: 'modern',
        name: 'Modern',
        description: 'Cart-focused layout. Full cart view on the right with all info. Categories & payment on the left.',
        icon: ShoppingCart,
        preview: '📦 Categories + Payment ← | → Full Cart',
        accent: 'violet',
    },
    {
        id: 'compact',
        name: 'Speed Terminal',
        description: 'High-speed dark mode. Dense table views, monospace numbers, optimized for fast cashiers.',
        icon: Zap,
        preview: '⚡ Products ← | → Dense Cart Table',
        accent: 'amber',
    },
];

const accentMap: Record<string, { bg: string; border: string; text: string; ring: string; glow: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-500', text: 'text-indigo-600', ring: 'ring-indigo-200', glow: 'shadow-indigo-100' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-500', text: 'text-violet-600', ring: 'ring-violet-200', glow: 'shadow-violet-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-600', ring: 'ring-amber-200', glow: 'shadow-amber-100' },
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-3xl shadow-2xl w-[680px] max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <Layout size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 tracking-tight">POS Layout</h2>
                            <p className="text-xs text-gray-400 font-medium">Choose the interface that fits your workflow</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Layout Cards */}
                <div className="p-8 space-y-4">
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
                                    "w-full p-5 rounded-2xl border-2 text-left transition-all hover:shadow-lg group",
                                    isActive
                                        ? `${accent.bg} ${accent.border} shadow-md ${accent.glow}`
                                        : "bg-white border-gray-100 hover:border-gray-200"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                                        isActive ? `${accent.bg} ${accent.text}` : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"
                                    )}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className={clsx(
                                                "text-sm font-black uppercase tracking-wider",
                                                isActive ? accent.text : "text-gray-900"
                                            )}>
                                                {layout.name}
                                            </h3>
                                            {isActive && (
                                                <span className={clsx("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", accent.bg, accent.text)}>
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{layout.description}</p>
                                        <div className="mt-3 px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-mono text-gray-400 inline-block">
                                            {layout.preview}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-[10px] text-gray-400 text-center">
                        Your preference is saved locally and will persist across sessions.
                    </p>
                </div>
            </div>
        </div>
    );
}
