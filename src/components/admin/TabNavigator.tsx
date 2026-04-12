'use client';

import { useAdmin } from '@/context/AdminContext';
import { X, MoreHorizontal, Home } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab, clearTabs } = useAdmin();
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(openTabs.length);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const containerWidth = entries[0].contentRect.width;
            const TAB_MIN_WIDTH = 160;
            const OVERFLOW_BTN = 56;
            setVisibleCount(Math.max(1, Math.floor((containerWidth - OVERFLOW_BTN) / TAB_MIN_WIDTH)));
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const visibleTabs = openTabs.slice(0, visibleCount);
    const hiddenTabs = openTabs.slice(visibleCount);

    return (
        <div
            className="flex items-end px-4 shrink-0 relative"
            style={{
                background: 'var(--app-surface-2)',
                borderBottom: '1px solid var(--app-border)',
                height: '44px',
            }}
        >
            <div ref={containerRef} className="flex-1 flex items-end gap-0.5 overflow-hidden h-full">
                {visibleTabs.map((tab) => (
                    <TabItem
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onOpen={openTab}
                        onClose={closeTab}
                    />
                ))}
            </div>

            {/* Overflow menu */}
            {hiddenTabs.length > 0 && (
                <div className="pb-1.5 ml-1 flex-shrink-0 relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl transition-all relative"
                        style={{
                            background: isMenuOpen ? 'var(--app-primary-light)' : 'var(--app-surface)',
                            border: `1px solid ${isMenuOpen ? 'var(--app-primary)' : 'var(--app-border)'}`,
                            color: isMenuOpen ? 'var(--app-primary)' : 'var(--app-text-muted)',
                        }}
                    >
                        <MoreHorizontal size={15} />
                        <span
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[9px] font-black rounded-full flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', color: '#fff' }}
                        >
                            {hiddenTabs.length}
                        </span>
                    </button>

                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                            <div
                                className="absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                <div
                                    className="px-4 py-2.5 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid var(--app-border)' }}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                                        Open Tabs
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); clearTabs(); setIsMenuOpen(false); }}
                                        className="text-[10px] font-bold transition-colors"
                                        style={{ color: 'var(--app-error, #ef4444)' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    >
                                        Clear all
                                    </button>
                                </div>
                                <div className="p-1.5 max-h-72 overflow-y-auto">
                                    {hiddenTabs.map((tab) => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <div
                                                key={tab.id}
                                                onClick={() => { openTab(tab.title, tab.path); setIsMenuOpen(false); }}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all group mb-0.5"
                                                style={{
                                                    background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                    border: isActive ? '1px solid var(--app-primary)' : '1px solid transparent',
                                                }}
                                                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                        style={{ background: isActive ? 'var(--app-primary)' : 'var(--app-border)' }}
                                                    />
                                                    <span
                                                        className="text-xs font-semibold truncate"
                                                        style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)' }}
                                                    >
                                                        {tab.title}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                                    className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                    style={{ color: 'var(--app-text-faint)' }}
                                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Clear all (when all tabs fit) */}
            {hiddenTabs.length === 0 && openTabs.length > 1 && (
                <button
                    onClick={clearTabs}
                    className="pb-2 ml-3 flex-shrink-0 text-[10px] font-black uppercase tracking-widest transition-all"
                    style={{ color: 'var(--app-text-faint)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
                >
                    Clear
                </button>
            )}
        </div>
    );
}

// ── Tab Item ──────────────────────────────────────────────────────────────────

const TabItem = React.memo(({ tab, isActive, onOpen, onClose }: {
    tab: { id: string; title: string; path: string };
    isActive: boolean;
    onOpen: (title: string, path: string) => void;
    onClose: (id: string) => void;
}) => {
    const isHome = tab.path === '/home';

    return (
        <div
            onClick={() => onOpen(tab.title, tab.path)}
            className="group flex items-center gap-2 px-3 cursor-pointer select-none flex-shrink-0 relative transition-all duration-150"
            style={{
                height: '36px',
                marginBottom: '0px',
                minWidth: '120px',
                maxWidth: '200px',
                borderRadius: '10px 10px 0 0',
                background: isActive ? 'var(--app-surface)' : 'transparent',
                borderTop: isActive ? '1px solid var(--app-border)' : '1px solid transparent',
                borderLeft: isActive ? '1px solid var(--app-border)' : '1px solid transparent',
                borderRight: isActive ? '1px solid var(--app-border)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--app-surface)' : '1px solid transparent',
                color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                // Lift active tab above the border line
                transform: isActive ? 'translateY(1px)' : 'translateY(0)',
                zIndex: isActive ? 10 : 1,
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
                }
            }}
        >
            {/* Active indicator bar */}
            {isActive && (
                <div
                    className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ background: 'var(--app-primary)' }}
                />
            )}

            {isHome
                ? <Home size={12} className="flex-shrink-0" />
                : null
            }

            <span className="flex-1 text-xs font-semibold truncate">
                {tab.title}
            </span>

            <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className="flex-shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--app-text-faint)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
            >
                <X size={11} />
            </button>
        </div>
    );
});

TabItem.displayName = 'TabItem';
