'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, Clock, Star, ArrowRight, ChevronRight, X,
    LayoutDashboard, Sparkles, Command, Zap
} from 'lucide-react';
import { getFavorites, saveFavorites } from '@/app/actions/favorites';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentEntry { title: string; path: string; visitedAt: number; }
interface PinnedEntry { title: string; path: string; }

const RECENT_KEY = 'tsf_quick_access_recent';
const PINNED_KEY = 'tsf_quick_access_pinned';
const MAX_RECENT = 12;

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
    const { replaceTab, openTabs } = useAdmin();
    const [recent, setRecent] = useState<RecentEntry[]>([]);
    const [pinned, setPinned] = useState<PinnedEntry[]>([]);
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);

    // Persist to localStorage and notify other components (Sidebar)
    const persistLocally = useCallback((favs: PinnedEntry[]) => {
        localStorage.setItem(PINNED_KEY, JSON.stringify(favs));
        window.dispatchEvent(new StorageEvent('storage', { key: PINNED_KEY }));
    }, []);

    useEffect(() => {
        setMounted(true);
        // 1. Load recent from localStorage
        try {
            const r = localStorage.getItem(RECENT_KEY);
            if (r) setRecent(JSON.parse(r));
        } catch { /* ignore */ }

        // 2. Show favorites from localStorage immediately (fast)
        try {
            const p = localStorage.getItem(PINNED_KEY);
            if (p) setPinned(JSON.parse(p));
        } catch { /* ignore */ }

        // 3. Fetch favorites from backend (cross-device source of truth)
        getFavorites().then(serverFavs => {
            if (serverFavs.length > 0) {
                setPinned(serverFavs);
                persistLocally(serverFavs);
            }
        }).catch(() => { /* stay on localStorage */ });
    }, [persistLocally]);

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

    const togglePin = useCallback((title: string, path: string) => {
        setPinned((prev) => {
            const exists = prev.find((p) => p.path === path);
            const next = exists ? prev.filter((p) => p.path !== path) : [...prev, { title, path }];
            persistLocally(next);
            saveFavorites(next).catch(() => {}); // backend sync, fire-and-forget
            return next;
        });
    }, [persistLocally]);

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

    const modules = MENU_ITEMS.filter((m) => m.title !== 'Dashboard');
    // replaceTab swaps the Home tab in-place → same position in tab bar, no new tab
    const navigate = (title: string, path: string) => { replaceTab(title, path); setSearch(''); };

    return (
        <div
            className="h-full flex flex-col"
            style={{
                /* Remove AdminShell padding so we fill the viewport exactly */
                margin: '-1.5rem',
                marginTop: '-1.5rem',
                width: 'calc(100% + 3rem)',
                height: 'calc(100% + 3rem)',
            }}
        >
            {/* ── Compact Header Bar ── */}
            <div
                className="shrink-0 px-6 py-4 flex items-center gap-6"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}
            >
                {/* Logo + Greeting */}
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        }}
                    >
                        <Zap size={18} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                            {mounted ? getGreeting() : 'Welcome'}
                        </p>
                        <h1 className="text-lg font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Quick Access
                        </h1>
                    </div>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <div
                        className="flex items-center gap-2.5 px-3.5 h-10 rounded-xl"
                        style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                        }}
                    >
                        <Search size={14} style={{ color: 'var(--app-text-muted)', flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Search pages..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-sm font-medium"
                            style={{ color: 'var(--app-text)' }}
                        />
                        {search ? (
                            <button onClick={() => setSearch('')} className="p-0.5 rounded hover:opacity-80">
                                <X size={12} style={{ color: 'var(--app-text-muted)' }} />
                            </button>
                        ) : (
                            <div
                                className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                                style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}
                            >
                                <Command size={8} />K
                            </div>
                        )}
                    </div>

                    {/* Search dropdown */}
                    {searchResults.length > 0 && (
                        <div
                            className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl overflow-hidden z-50"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                        >
                            {searchResults.map((p) => (
                                <button
                                    key={p.path}
                                    onClick={() => navigate(p.title, p.path)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b last:border-0"
                                    style={{ borderColor: 'var(--app-border)' }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2, var(--app-bg))'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <Zap size={10} style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate" style={{ color: 'var(--app-text)' }}>{p.title}</p>
                                        <p className="text-[9px] truncate" style={{ color: 'var(--app-text-faint)' }}>{p.parent}</p>
                                    </div>
                                    <ArrowRight size={10} style={{ color: 'var(--app-text-faint)' }} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Compact stats */}
                <div className="hidden lg:flex items-center gap-4 shrink-0">
                    <div className="text-center px-3">
                        <p className="text-xl font-black" style={{ color: 'var(--app-text)' }}>{pinned.length}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Favorites</p>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'var(--app-border)' }} />
                    <div className="text-center px-3">
                        <p className="text-xl font-black" style={{ color: 'var(--app-text)' }}>{recent.length}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Recent</p>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'var(--app-border)' }} />
                    <div className="text-center px-3">
                        <p className="text-xl font-black" style={{ color: 'var(--app-primary)' }}>{allPages.length}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Pages</p>
                    </div>
                </div>
            </div>

            {/* ── Main Grid ── */}
            <div
                className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[280px_1fr] overflow-hidden"
                style={{ background: 'var(--app-bg)' }}
            >
                {/* ── Left Sidebar: Pinned + Recent ── */}
                <div
                    className="hidden xl:flex flex-col min-h-0 overflow-y-auto"
                    style={{ borderRight: '1px solid var(--app-border)' }}
                >
                    {/* Pinned Section */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <Star size={11} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                                Favorites
                            </span>
                        </div>
                        {pinned.length === 0 ? (
                            <p className="text-[10px] italic px-2 py-3" style={{ color: 'var(--app-text-faint)' }}>
                                Star pages from modules to add favorites
                            </p>
                        ) : (
                            <div className="space-y-0.5">
                                {pinned.map((p) => (
                                    <div
                                        key={p.path}
                                        className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                                        onClick={() => navigate(p.title, p.path)}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        <Star size={10} fill="currentColor" style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>{p.title}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); togglePin(p.title, p.path); }}
                                            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                                        >
                                            <X size={10} style={{ color: 'var(--app-text-faint)' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mx-4 my-1" style={{ height: 1, background: 'var(--app-border)' }} />

                    {/* Recent Section */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <Clock size={11} style={{ color: 'var(--app-text-faint)' }} />
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                                Recent
                            </span>
                        </div>
                        {recent.length === 0 ? (
                            <p className="text-[10px] italic px-2 py-3" style={{ color: 'var(--app-text-faint)' }}>
                                Pages you visit will appear here
                            </p>
                        ) : (
                            <div className="space-y-0.5">
                                {recent.slice(0, 10).map((r) => {
                                    const isPinned = pinned.some((p) => p.path === r.path);
                                    return (
                                        <div
                                            key={r.path}
                                            className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                                            onClick={() => navigate(r.title, r.path)}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <div
                                                className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                                            >
                                                <Clock size={8} style={{ color: 'var(--app-text-faint)' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>{r.title}</p>
                                                <p className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{timeAgo(r.visitedAt)}</p>
                                            </div>
                                            <button
                                                title={isPinned ? 'Remove from favorites' : 'Add to favorites'}
                                                onClick={(e) => { e.stopPropagation(); togglePin(r.title, r.path); }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                                                style={{ color: isPinned ? 'var(--app-primary)' : 'var(--app-text-faint)' }}
                                            >
                                                <Star size={10} fill={isPinned ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className="shrink-0 px-4 py-2.5 flex items-center justify-center gap-1.5"
                        style={{ borderTop: '1px solid var(--app-border)' }}
                    >
                        <Command size={9} style={{ color: 'var(--app-text-faint)' }} />
                        <span className="text-[9px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
                            Ctrl+K for command palette
                        </span>
                    </div>
                </div>

                {/* ── Right: Modules Grid ── */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5">
                    {/* Dashboard Card */}
                    <button
                        onClick={() => navigate('Dashboard', '/dashboard')}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-xl mb-4 text-left transition-all group"
                        style={{
                            background: 'var(--app-primary)',
                            boxShadow: '0 4px 16px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        }}
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/20">
                            <LayoutDashboard size={18} style={{ color: '#fff' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white">Dashboard</p>
                            <p className="text-[10px] text-white/70">Analytics · KPIs · Overview</p>
                        </div>
                        <ArrowRight size={14} className="flex-shrink-0 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Modules Grid */}
                    <div className="flex items-center gap-1.5 mb-3">
                        <LayoutDashboard size={11} style={{ color: 'var(--app-text-faint)' }} />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                            Modules
                        </span>
                        <span className="text-[9px] font-bold ml-auto" style={{ color: 'var(--app-text-faint)' }}>
                            {modules.length} available
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                        {modules.map((mod) => {
                            const Icon = mod.icon;
                            const quickLinks: { title: string; path: string }[] = [];
                            function collect(items: typeof MENU_ITEMS) {
                                for (const item of items) {
                                    if (quickLinks.length >= 3) break;
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
                                    className="flex flex-col p-4 rounded-xl transition-all group"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: '1px solid var(--app-border)',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-primary) 40%, var(--app-border))';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)';
                                    }}
                                >
                                    {/* Module header */}
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                color: 'var(--app-primary)',
                                            }}
                                        >
                                            {Icon && <Icon size={15} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black truncate" style={{ color: 'var(--app-text)' }}>{mod.title}</p>
                                            <p className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
                                                {mod.children?.length || 0} sections
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quick links */}
                                    {quickLinks.length > 0 && (
                                        <div className="space-y-px">
                                            {quickLinks.map((link) => {
                                                const isFav = pinned.some((p) => p.path === link.path);
                                                return (
                                                    <div
                                                        key={link.path}
                                                        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors"
                                                        onMouseEnter={(e) => {
                                                            (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-primary) 8%, transparent)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                        }}
                                                    >
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(link.title, link.path); }}
                                                            className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                                                            style={{ color: 'var(--app-text-muted)' }}
                                                        >
                                                            <ChevronRight size={9} className="shrink-0" />
                                                            <span className="text-[11px] font-medium truncate">{link.title}</span>
                                                        </button>
                                                        <button
                                                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                                            onClick={(e) => { e.stopPropagation(); togglePin(link.title, link.path); }}
                                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded shrink-0 transition-opacity"
                                                            style={{ color: isFav ? 'var(--app-primary)' : 'var(--app-text-faint)' }}
                                                        >
                                                            <Star size={9} fill={isFav ? 'currentColor' : 'none'} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
