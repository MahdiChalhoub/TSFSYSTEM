'use client';

import { useAdmin } from '@/context/AdminContext';
import { X, Plus, MoreHorizontal } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';

const TAB_W = 148;
const ACTIONS_W = 72; // + button + overflow button

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab, clearTabs } = useAdmin();
    const containerRef = useRef<HTMLDivElement>(null);
    const [maxVisible, setMaxVisible] = useState(20);
    const [overflow, setOverflow] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Measure available width once and on resize
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            const w = e.contentRect.width;
            setMaxVisible(Math.max(1, Math.floor((w - ACTIONS_W) / TAB_W)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        setOverflow(openTabs.length > maxVisible);
    }, [openTabs.length, maxVisible]);

    // Close overflow menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const h = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [menuOpen]);

    const openHome = useCallback(() => openTab('Home', '/home'), [openTab]);

    const visible = openTabs.slice(0, maxVisible);
    const hidden  = openTabs.slice(maxVisible);

    return (
        <div
            ref={containerRef}
            className="flex items-stretch shrink-0"
            style={{
                background: 'var(--app-surface-2)',
                borderBottom: '1px solid var(--app-border)',
                height: '34px',
            }}
        >
            {/* Tabs */}
            <div className="flex items-stretch flex-1 overflow-hidden">
                {visible.map((tab) => (
                    <Tab
                        key={tab.id}
                        tab={tab}
                        active={activeTab === tab.id}
                        onOpen={openTab}
                        onClose={closeTab}
                    />
                ))}
            </div>

            {/* New tab */}
            <button
                onClick={openHome}
                title="New tab"
                className="flex items-center justify-center w-8 flex-shrink-0 transition-colors"
                style={{ color: 'var(--app-text-faint)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
                <Plus size={13} strokeWidth={2.5} />
            </button>

            {/* Overflow */}
            {overflow && (
                <div className="relative flex-shrink-0" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className="flex items-center justify-center w-8 h-full transition-colors relative"
                        style={{
                            color: menuOpen ? 'var(--app-primary)' : 'var(--app-text-faint)',
                            background: menuOpen ? 'var(--app-primary-light)' : 'transparent',
                        }}
                    >
                        <MoreHorizontal size={13} />
                        <span
                            className="absolute top-1 right-1 flex items-center justify-center rounded-full text-[8px] font-black leading-none"
                            style={{ background: 'var(--app-primary)', color: '#fff', width: 13, height: 13 }}
                        >
                            {hidden.length}
                        </span>
                    </button>

                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                            <div
                                className="absolute top-full right-0 mt-1 w-56 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                            >
                                <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-faint)' }}>
                                        {hidden.length} more
                                    </span>
                                    <button
                                        onClick={() => { clearTabs(); setMenuOpen(false); }}
                                        className="text-[9px] font-bold transition-opacity hover:opacity-70"
                                        style={{ color: 'var(--app-error, #ef4444)' }}
                                    >
                                        Clear all
                                    </button>
                                </div>
                                <div className="py-1 max-h-60 overflow-y-auto">
                                    {hidden.map(tab => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <div
                                                key={tab.id}
                                                className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                                                style={{
                                                    background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                    color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                                                }}
                                                onClick={() => { openTab(tab.title, tab.path); setMenuOpen(false); }}
                                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isActive ? 'var(--app-primary)' : 'var(--app-border)' }} />
                                                <span className="flex-1 text-xs font-medium truncate">{tab.title}</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                                                    style={{ color: 'var(--app-text-faint)' }}
                                                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
                                                >
                                                    <X size={10} />
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
        </div>
    );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

const Tab = React.memo(({ tab, active, onOpen, onClose }: {
    tab: { id: string; title: string; path: string };
    active: boolean;
    onOpen: (t: string, p: string) => void;
    onClose: (id: string) => void;
}) => (
    <div
        onClick={() => onOpen(tab.title, tab.path)}
        className="group relative flex items-center gap-1.5 px-3 cursor-pointer select-none flex-shrink-0 transition-colors"
        style={{
            width: TAB_W,
            background: active ? 'var(--app-surface)' : 'transparent',
            borderRight: '1px solid var(--app-border)',
            color: active ? 'var(--app-text)' : 'var(--app-text-faint)',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
        {/* Active accent */}
        {active && (
            <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'var(--app-primary)' }}
            />
        )}
        <span className="flex-1 text-xs font-semibold truncate">{tab.title}</span>
        <button
            onClick={e => { e.stopPropagation(); onClose(tab.id); }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
            style={{ color: 'var(--app-text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
        >
            <X size={10} strokeWidth={2.5} />
        </button>
    </div>
));

Tab.displayName = 'Tab';
