'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useMemo } from 'react';
import {
    Search, Clock, Star, ArrowRight, Zap, ChevronRight,
    LayoutDashboard, Sparkles, TrendingUp, Command
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentEntry {
    title: string;
    path: string;
    visitedAt: number;
}

interface PinnedEntry {
    title: string;
    path: string;
}

const RECENT_KEY = 'tsf_quick_access_recent';
const PINNED_KEY = 'tsf_quick_access_pinned';
const MAX_RECENT = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ── Quick Access Page ─────────────────────────────────────────────────────────

export default function QuickAccessPage() {
    const { openTab, openTabs } = useAdmin();
    const [recent, setRecent] = useState<RecentEntry[]>([]);
    const [pinned, setPinned] = useState<PinnedEntry[]>([]);
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        setMounted(true);
        try {
            const r = localStorage.getItem(RECENT_KEY);
            if (r) setRecent(JSON.parse(r));
            const p = localStorage.getItem(PINNED_KEY);
            if (p) setPinned(JSON.parse(p));
        } catch { /* ignore */ }
    }, []);

    // Record current open tabs as recent
    useEffect(() => {
        if (!mounted) return;
        setRecent((prev) => {
            const updated = [...prev];
            openTabs.forEach((tab) => {
                if (tab.path === '/home') return;
                const idx = updated.findIndex((r) => r.path === tab.path);
                const entry: RecentEntry = { title: tab.title, path: tab.path, visitedAt: Date.now() };
                if (idx !== -1) updated.splice(idx, 1);
                updated.unshift(entry);
            });
            const trimmed = updated.slice(0, MAX_RECENT);
            localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
            return trimmed;
        });
    }, [openTabs, mounted]);

    const pinPage = (title: string, path: string) => {
        setPinned((prev) => {
            if (prev.find((p) => p.path === path)) return prev;
            const next = [...prev, { title, path }];
            localStorage.setItem(PINNED_KEY, JSON.stringify(next));
            return next;
        });
    };

    const unpinPage = (path: string) => {
        setPinned((prev) => {
            const next = prev.filter((p) => p.path !== path);
            localStorage.setItem(PINNED_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Flatten all leaf pages for search
    const allPages = useMemo(() => {
        const pages: { title: string; path: string; parent: string }[] = [];
        function walk(items: typeof MENU_ITEMS, breadcrumb: string) {
            for (const item of items) {
                if ('path' in item && item.path) {
                    pages.push({ title: item.title, path: item.path as string, parent: breadcrumb });
                }
                if ('children' in item && item.children) {
                    walk(item.children as typeof MENU_ITEMS, `${breadcrumb} › ${item.title}`);
                }
            }
        }
        walk(MENU_ITEMS, 'TSF');
        return pages;
    }, []);

    const searchResults = useMemo(() => {
        if (!search.trim()) return [];
        const q = search.toLowerCase();
        return allPages
            .filter((p) => p.title.toLowerCase().includes(q) || p.parent.toLowerCase().includes(q))
            .slice(0, 8);
    }, [search, allPages]);

    // Top-level modules for the grid
    const modules = MENU_ITEMS.filter((m) => m.title !== 'Dashboard');

    const navigate = (title: string, path: string) => {
        openTab(title, path);
        setSearch('');
    };

    return (
        <div
            className="min-h-full"
            style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}
        >
            {/* ── Hero ── */}
            <div
                className="relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-primary-hover, var(--app-primary)) 100%)',
                    minHeight: '200px',
                }}
            >
                {/* Decorative circles */}
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10" style={{ background: '#fff' }} />
                <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
                <div className="absolute top-8 right-1/3 w-24 h-24 rounded-full opacity-5" style={{ background: '#fff' }} />

                <div className="relative z-10 px-8 pt-10 pb-16">
                    {/* Greeting */}
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={16} className="opacity-80" style={{ color: '#fff' }} />
                        <span className="text-sm font-bold opacity-80" style={{ color: '#fff' }}>
                            {mounted ? getGreeting() : 'Welcome back'}
                        </span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-6" style={{ color: '#fff' }}>
                        Quick Access
                    </h1>

                    {/* Search */}
                    <div className="relative max-w-xl">
                        <div
                            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl"
                            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
                        >
                            <Search size={18} style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search any page, module, setting..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent outline-none text-sm font-medium"
                                style={{ color: 'var(--app-text)' }}
                            />
                            {search ? (
                                <button onClick={() => setSearch('')} className="text-xs font-bold opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--app-text)' }}>
                                    Clear
                                </button>
                            ) : (
                                <div
                                    className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold opacity-50"
                                    style={{ border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                                >
                                    <Command size={10} /> K
                                </div>
                            )}
                        </div>

                        {/* Search results dropdown */}
                        {searchResults.length > 0 && (
                            <div
                                className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                            >
                                {searchResults.map((p) => (
                                    <button
                                        key={p.path}
                                        onClick={() => navigate(p.title, p.path)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b last:border-0"
                                        style={{ borderColor: 'var(--app-border)' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'var(--app-primary-light)' }}
                                        >
                                            <Zap size={12} style={{ color: 'var(--app-primary)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{p.title}</p>
                                            <p className="text-[10px] truncate" style={{ color: 'var(--app-text-faint)' }}>{p.parent}</p>
                                        </div>
                                        <ArrowRight size={14} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-8 py-8 max-w-7xl mx-auto space-y-10 -mt-6">

                {/* ── Pinned ── */}
                {pinned.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Star size={14} style={{ color: 'var(--app-primary)' }} />
                                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Pinned</h2>
                            </div>
                            <button
                                onClick={() => setEditMode(!editMode)}
                                className="text-[10px] font-bold transition-colors"
                                style={{ color: 'var(--app-text-faint)' }}
                            >
                                {editMode ? 'Done' : 'Edit'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {pinned.map((p) => (
                                <button
                                    key={p.path}
                                    onClick={() => editMode ? unpinPage(p.path) : navigate(p.title, p.path)}
                                    className="relative flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all group"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: editMode ? '1px solid var(--app-error, #ef4444)' : '1px solid var(--app-border)',
                                    }}
                                    onMouseEnter={(e) => { if (!editMode) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                                    onMouseLeave={(e) => { if (!editMode) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
                                >
                                    {editMode && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black" style={{ background: 'var(--app-error, #ef4444)' }}>
                                            ×
                                        </div>
                                    )}
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                                    >
                                        <Star size={16} />
                                    </div>
                                    <span className="text-xs font-bold leading-tight" style={{ color: 'var(--app-text)' }}>{p.title}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Recent ── */}
                {recent.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={14} style={{ color: 'var(--app-text-faint)' }} />
                            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Recent</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {recent.slice(0, 8).map((r) => {
                                const isPinned = pinned.some((p) => p.path === r.path);
                                return (
                                    <div
                                        key={r.path}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                                        style={{
                                            background: 'var(--app-surface)',
                                            border: '1px solid var(--app-border)',
                                        }}
                                        onClick={() => navigate(r.title, r.path)}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'var(--app-surface-2)', color: 'var(--app-primary)' }}
                                        >
                                            <TrendingUp size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{r.title}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{timeAgo(r.visitedAt)}</p>
                                        </div>
                                        <button
                                            title={isPinned ? 'Unpin' : 'Pin'}
                                            onClick={(e) => { e.stopPropagation(); isPinned ? unpinPage(r.path) : pinPage(r.title, r.path); }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                                            style={{
                                                color: isPinned ? 'var(--app-primary)' : 'var(--app-text-faint)',
                                                background: isPinned ? 'var(--app-primary-light)' : 'transparent',
                                            }}
                                        >
                                            <Star size={12} fill={isPinned ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── Modules Grid ── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <LayoutDashboard size={14} style={{ color: 'var(--app-text-faint)' }} />
                        <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>All Modules</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {/* Dashboard card */}
                        <button
                            onClick={() => navigate('Dashboard', '/dashboard')}
                            className="flex items-center gap-4 p-5 rounded-2xl text-left transition-all group"
                            style={{
                                background: 'var(--app-primary)',
                                border: '1px solid transparent',
                            }}
                        >
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20">
                                <LayoutDashboard size={20} style={{ color: '#fff' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white">Dashboard</p>
                                <p className="text-[11px] text-white/70">Overview & metrics</p>
                            </div>
                            <ArrowRight size={16} className="flex-shrink-0 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        {/* Module cards */}
                        {modules.map((mod) => {
                            const Icon = mod.icon;
                            // Gather quick links (first few leaf pages)
                            const quickLinks: { title: string; path: string }[] = [];
                            function collect(items: typeof MENU_ITEMS) {
                                for (const item of items) {
                                    if (quickLinks.length >= 4) break;
                                    if ('path' in item && item.path) {
                                        quickLinks.push({ title: item.title, path: item.path as string });
                                    } else if ('children' in item && item.children) {
                                        collect(item.children as typeof MENU_ITEMS);
                                    }
                                }
                            }
                            if (mod.children) collect(mod.children as typeof MENU_ITEMS);

                            return (
                                <div
                                    key={mod.title}
                                    className="flex flex-col p-5 rounded-2xl transition-all group"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: '1px solid var(--app-border)',
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; }}
                                >
                                    {/* Module header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                                        >
                                            {Icon && <Icon size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black" style={{ color: 'var(--app-text)' }}>{mod.title}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                                                {mod.children?.length || 0} sections
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quick links */}
                                    {quickLinks.length > 0 && (
                                        <div className="space-y-0.5">
                                            {quickLinks.map((link) => (
                                                <button
                                                    key={link.path}
                                                    onClick={(e) => { e.stopPropagation(); navigate(link.title, link.path); }}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-all"
                                                    style={{ color: 'var(--app-text-muted)' }}
                                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; }}
                                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                                                >
                                                    <ChevronRight size={10} className="flex-shrink-0" />
                                                    <span className="text-xs font-medium truncate">{link.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ── Footer hint ── */}
                <div className="flex items-center justify-center gap-2 py-4 opacity-40">
                    <Command size={12} style={{ color: 'var(--app-text-faint)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
                        Press Ctrl+K anywhere for command palette
                    </span>
                </div>
            </div>
        </div>
    );
}
