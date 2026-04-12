'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { X, Plus, MoreHorizontal, Rows3, PanelLeft, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Color palette — deterministic from path hash ──────────────────────────────

const PALETTE = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b',
    '#10b981', '#ef4444', '#ec4899', '#f97316',
    '#14b8a6', '#a855f7', '#3b82f6', '#84cc16',
];

function tabColor(path: string): string {
    let h = 0;
    for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
}

function abbrev(title: string): string {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return title.slice(0, 2).toUpperCase();
}

// Map a path to the closest icon from MENU_ITEMS (first matching ancestor)
function getIconForPath(path: string): React.ElementType | null {
    function search(items: typeof MENU_ITEMS): React.ElementType | null {
        for (const item of items) {
            if ('path' in item && item.path === path && 'icon' in item && item.icon) return item.icon as React.ElementType;
            if ('children' in item && item.children) {
                const found = search(item.children as typeof MENU_ITEMS);
                if (found) return found;
                // If a child matched, return the parent icon
                if ('children' in item && item.children) {
                    for (const child of item.children as typeof MENU_ITEMS) {
                        if ('path' in child && child.path === path) {
                            return 'icon' in item && item.icon ? item.icon as React.ElementType : null;
                        }
                    }
                }
            }
        }
        return null;
    }
    return search(MENU_ITEMS);
}

// ── Horizontal Tab Navigator ──────────────────────────────────────────────────

const TAB_W = 144;
const BTNS_W = 112; // +, clear, switch

export function TabNavigator() {
    const { openTabs, activeTab, closeTab, openTab, clearTabs, tabLayout, setTabLayout } = useAdmin();
    const containerRef = useRef<HTMLDivElement>(null);
    const [maxVisible, setMaxVisible] = useState(20);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            setMaxVisible(Math.max(1, Math.floor((e.contentRect.width - BTNS_W) / TAB_W)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

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
    const hidden = openTabs.slice(maxVisible);

    // ── Vertical rail ─────────────────────────────────────────────────────────
    if (tabLayout === 'vertical') {
        return (
            <div
                className="flex flex-col items-center py-2 gap-1 flex-shrink-0 overflow-y-auto overflow-x-hidden"
                style={{
                    width: 52,
                    background: 'var(--app-surface-2)',
                    borderLeft: '1px solid var(--app-border)',
                }}
            >
                {/* Switch back to horizontal */}
                <IconBtn
                    title="Switch to horizontal tabs"
                    onClick={() => setTabLayout('horizontal')}
                    style={{ color: 'var(--app-primary)', marginBottom: 4 }}
                >
                    <Rows3 size={14} />
                </IconBtn>

                {/* Divider */}
                <div className="w-7 h-px mb-1" style={{ background: 'var(--app-border)' }} />

                {/* Tab badges */}
                {openTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    const color = tabColor(tab.path);
                    const Icon = getIconForPath(tab.path);
                    const label = abbrev(tab.title);
                    return (
                        <VerticalTab
                            key={tab.id}
                            tab={tab}
                            active={active}
                            color={color}
                            icon={Icon}
                            label={label}
                            onOpen={openTab}
                            onClose={closeTab}
                        />
                    );
                })}

                {/* Divider */}
                <div className="w-7 h-px mt-1 mb-1" style={{ background: 'var(--app-border)' }} />

                {/* New tab */}
                <IconBtn title="New tab" onClick={openHome} style={{ color: 'var(--app-text-faint)' }}>
                    <Plus size={13} strokeWidth={2.5} />
                </IconBtn>

                {/* Clear all */}
                {openTabs.length > 1 && (
                    <IconBtn title="Clear all tabs" onClick={clearTabs} style={{ color: 'var(--app-text-faint)' }}>
                        <Trash2 size={13} />
                    </IconBtn>
                )}
            </div>
        );
    }

    // ── Horizontal strip ──────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="flex items-stretch shrink-0"
            style={{
                background: 'var(--app-surface-2)',
                borderBottom: '1px solid var(--app-border)',
                height: 34,
            }}
        >
            {/* Visible tabs */}
            <div className="flex items-stretch flex-1 overflow-hidden">
                {visible.map((tab) => (
                    <HTab key={tab.id} tab={tab} active={activeTab === tab.id} onOpen={openTab} onClose={closeTab} />
                ))}
            </div>

            {/* Overflow */}
            {hidden.length > 0 && (
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
                            className="absolute top-1 right-0.5 flex items-center justify-center rounded-full text-[8px] font-black leading-none"
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
                                    <button onClick={() => { clearTabs(); setMenuOpen(false); }} className="text-[9px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                        Clear all
                                    </button>
                                </div>
                                <div className="py-1 max-h-60 overflow-y-auto">
                                    {hidden.map(tab => {
                                        const isActive = activeTab === tab.id;
                                        const color = tabColor(tab.path);
                                        return (
                                            <div
                                                key={tab.id}
                                                className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                                                style={{ background: isActive ? 'var(--app-primary-light)' : 'transparent', color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)' }}
                                                onClick={() => { openTab(tab.title, tab.path); setMenuOpen(false); }}
                                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                            >
                                                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-black text-white" style={{ background: color }}>
                                                    {abbrev(tab.title)}
                                                </div>
                                                <span className="flex-1 text-xs font-medium truncate">{tab.title}</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded"
                                                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                                    style={{ color: 'var(--app-text-faint)' }}
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

            {/* + New tab */}
            <button
                onClick={openHome}
                title="New tab"
                className="flex items-center justify-center w-8 flex-shrink-0 transition-colors"
                style={{ color: 'var(--app-text-faint)', borderLeft: '1px solid var(--app-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
                <Plus size={13} strokeWidth={2.5} />
            </button>

            {/* Clear */}
            {openTabs.length > 0 && (
                <button
                    onClick={clearTabs}
                    title="Clear all tabs"
                    className="flex items-center justify-center w-8 flex-shrink-0 transition-colors"
                    style={{ color: 'var(--app-text-faint)', borderLeft: '1px solid var(--app-border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    <Trash2 size={12} />
                </button>
            )}

            {/* Switch to vertical */}
            <button
                onClick={() => setTabLayout('vertical')}
                title="Switch to vertical tab rail"
                className="flex items-center justify-center w-8 flex-shrink-0 transition-colors"
                style={{ color: 'var(--app-text-faint)', borderLeft: '1px solid var(--app-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
                <PanelLeft size={13} />
            </button>
        </div>
    );
}

// ── Horizontal Tab ────────────────────────────────────────────────────────────

const HTab = React.memo(({ tab, active, onOpen, onClose }: {
    tab: { id: string; title: string; path: string };
    active: boolean;
    onOpen: (t: string, p: string) => void;
    onClose: (id: string) => void;
}) => {
    const color = useMemo(() => tabColor(tab.path), [tab.path]);

    return (
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
            {/* Color accent top bar */}
            <div
                className="absolute top-0 left-0 right-0 transition-all"
                style={{ height: active ? 2 : 0, background: color }}
            />
            {/* Color dot */}
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, opacity: active ? 1 : 0.5 }} />
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
    );
});
HTab.displayName = 'HTab';

// ── Vertical Tab Badge ────────────────────────────────────────────────────────

const VerticalTab = React.memo(({ tab, active, color, icon: Icon, label, onOpen, onClose }: {
    tab: { id: string; title: string; path: string };
    active: boolean;
    color: string;
    icon: React.ElementType | null;
    label: string;
    onOpen: (t: string, p: string) => void;
    onClose: (id: string) => void;
}) => {
    const [hovered, setHovered] = useState(false);

    return (
        <div className="relative group flex-shrink-0" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <button
                onClick={() => onOpen(tab.title, tab.path)}
                className="flex items-center justify-center rounded-xl transition-all duration-150"
                style={{
                    width: 36,
                    height: 36,
                    background: active ? color : 'transparent',
                    border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
                    color: active ? '#fff' : color,
                    boxShadow: active ? `0 2px 8px ${color}44` : 'none',
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                }}
                onMouseEnter={e => {
                    if (!active) {
                        (e.currentTarget as HTMLElement).style.background = `${color}22`;
                        (e.currentTarget as HTMLElement).style.borderColor = color;
                    }
                }}
                onMouseLeave={e => {
                    if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }
                }}
            >
                {Icon
                    ? <Icon size={14} />
                    : <span className="text-[10px] font-black leading-none">{label}</span>
                }
            </button>

            {/* Close on hover */}
            {hovered && (
                <button
                    onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--app-error, #ef4444)', color: '#fff' }}
                >
                    <X size={8} strokeWidth={3} />
                </button>
            )}

            {/* Tooltip */}
            {hovered && (
                <div
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap z-50 pointer-events-none shadow-xl animate-in fade-in duration-100"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        color: 'var(--app-text)',
                    }}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        {tab.title}
                    </div>
                </div>
            )}
        </div>
    );
});
VerticalTab.displayName = 'VerticalTab';

// ── Icon Button helper ────────────────────────────────────────────────────────

function IconBtn({ children, title, onClick, style }: {
    children: React.ReactNode;
    title: string;
    onClick: () => void;
    style?: React.CSSProperties;
}) {
    return (
        <button
            title={title}
            onClick={onClick}
            className="flex items-center justify-center rounded-xl transition-all flex-shrink-0"
            style={{ width: 32, height: 32, ...style }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}
