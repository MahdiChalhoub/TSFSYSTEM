'use client';

import { POSLayoutVariant } from '@/types/pos-layout';
import { Layout, X, Monitor, Zap, ShoppingCart, Sparkles, BrainCircuit, Wind } from 'lucide-react';
import clsx from 'clsx';

const LAYOUTS: { id: POSLayoutVariant; name: string; description: string; icon: any; preview: string }[] = [
    { id: 'classic', name: 'Standard', description: 'Classic layout. Products left, order panel right. Familiar flow.', icon: Monitor, preview: '🛒 Classic Split Layout' },
    { id: 'modern', name: 'Modern', description: 'Full-featured cart interface with multi-payment, numpad, delivery zones, and premium visuals.', icon: ShoppingCart, preview: '📦 Modern: Full Feature Cart' },
    { id: 'compact', name: 'Quick Mode', description: 'Compact dark mode. Fast and focused.', icon: Zap, preview: '⚡ Speed Mode: Compact View' },
    { id: 'original', name: 'Original Modern', description: 'The original clean cart-focused layout. Categories & payment left, full cart view right.', icon: Sparkles, preview: '✨ Classic Modern: Clean Cart Focus' },
    { id: 'intelligence', name: 'Analytics View', description: 'Enhanced layout with analytics and performance insights.', icon: BrainCircuit, preview: '🧠 Analytics: Expanded View' },
    { id: 'arctic-glass', name: 'Arctic Glass', description: 'Clean light-mode layout. Sky-blue primary, Apple-style typography. Follows the global Arctic Glass theme.', icon: Wind, preview: '🌊 Arctic Glass: Clean & Modern' },
];

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
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={onClose}
        >
            <div
                className="w-[720px] max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-500 relative rounded-3xl"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: 'var(--app-shadow-lg)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="px-10 py-8 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-5">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}
                        >
                            <Layout size={24} color="#fff" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tighter" style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font-display)' }}>
                                Interface Configuration
                            </h2>
                            <p className="text-[11px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                Choose a layout
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Layout Cards */}
                <div className="p-8 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {LAYOUTS.map(layout => {
                        const isActive = currentLayout === layout.id;
                        const Icon = layout.icon;

                        return (
                            <button
                                key={layout.id}
                                onClick={() => { onSelect(layout.id); onClose(); }}
                                className="w-full p-6 rounded-2xl text-left transition-all hover:-translate-y-0.5 group relative overflow-hidden border-2"
                                style={isActive ? {
                                    background: 'var(--app-primary-light)',
                                    borderColor: 'var(--app-primary)',
                                    boxShadow: '0 8px 24px var(--app-primary-glow)',
                                } : {
                                    background: 'var(--app-surface-2)',
                                    borderColor: 'var(--app-border)',
                                }}
                            >
                                <div className="flex items-start gap-6 relative z-10">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500"
                                        style={isActive ? {
                                            background: 'var(--app-primary)',
                                            color: '#fff',
                                            transform: 'rotate(6deg)',
                                            boxShadow: '0 8px 20px var(--app-primary-glow)',
                                        } : {
                                            background: 'var(--app-surface)',
                                            color: 'var(--app-text-muted)',
                                            border: '1px solid var(--app-border)',
                                        }}
                                    >
                                        <Icon size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3
                                                className="text-[15px] font-black uppercase tracking-tight"
                                                style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-text)' }}
                                            >
                                                {layout.name}
                                            </h3>
                                            {isActive && (
                                                <span
                                                    className="text-app-text text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                                                    style={{ background: 'var(--app-primary)' }}
                                                >
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[12px] mt-2 leading-relaxed font-bold" style={{ color: 'var(--app-text-muted)' }}>
                                            {layout.description}
                                        </p>
                                        <div
                                            className="mt-4 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2"
                                            style={{
                                                background: 'var(--app-surface)',
                                                border: '1px solid var(--app-border)',
                                                color: 'var(--app-text-muted)',
                                            }}
                                        >
                                            <div
                                                className="w-1.5 h-1.5 rounded-full animate-pulse"
                                                style={{ background: 'var(--app-primary)' }}
                                            />
                                            {layout.preview}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div
                    className="px-10 py-4"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}
                >
                    <p className="text-[10px] font-black text-center uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                        Layout preference saved locally.
                    </p>
                </div>
            </div>
        </div>
    );
}
