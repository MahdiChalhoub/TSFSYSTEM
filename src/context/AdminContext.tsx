'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Tab = {
    id: string;
    title: string;
    path: string;
};

/**
 * Scope access levels (determined at LOGIN by which password was used):
 *  - null: not yet loaded / no dual view
 *  - 'official': user logged in with Official password → sees ONLY Official data, no toggle
 *  - 'internal': user logged in with main or Internal password → sees BOTH scopes with toggle
 */
type ScopeAccess = 'official' | 'internal' | null;

type AdminContextType = {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    openTabs: Tab[];
    activeTab: string;
    openTab: (title: string, path: string) => void;
    replaceTab: (title: string, path: string) => void;
    closeTab: (id: string) => void;
    clearTabs: () => void;
    /**
     * Reorder open tabs by drag-and-drop. `position` decides whether the
     * dragged tab lands immediately before or after the target. No edit
     * mode, no save — order is just whatever the user last arranged.
     */
    reorderTabs: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
    viewScope: 'OFFICIAL' | 'INTERNAL';
    setViewScope: (scope: 'OFFICIAL' | 'INTERNAL') => void;
    /** Which access level the user was granted at login */
    scopeAccess: ScopeAccess;
    /** Whether the scope toggle should be visible (only in 'internal' access mode) */
    canToggleScope: boolean;
    /** Navigation layout: vertical sidebar or horizontal top-nav */
    navLayout: 'sidebar' | 'topnav';
    setNavLayout: (layout: 'sidebar' | 'topnav') => void;
    /** Tab bar layout: horizontal strip or vertical rail */
    tabLayout: 'horizontal' | 'vertical';
    setTabLayout: (layout: 'horizontal' | 'vertical') => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children, contextKey = 'default', initialScopeAccess, initialNavLayout, initialTabLayout }: { children: React.ReactNode, contextKey?: string, initialScopeAccess?: 'official' | 'internal' | null, initialNavLayout?: 'sidebar' | 'topnav', initialTabLayout?: 'horizontal' | 'vertical' }) {
    // Start open on desktop, closed on mobile — avoids the fixed-overlay blocking content
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [pendingActiveTab, setPendingActiveTab] = useState<string | null>(null);
    const [viewScope, setViewScope] = useState<'OFFICIAL' | 'INTERNAL'>('INTERNAL');
    const [isLoaded, setIsLoaded] = useState(false);
    // Initialize from server prop so SSR and first client render match — no pop-in flash
    const [scopeAccess, setScopeAccess] = useState<ScopeAccess>(initialScopeAccess ?? null);
    // Initialize from server-passed props (read from cookies in layout.tsx) so SSR
    // and first client render are identical — no hydration mismatch, no flash.
    const [navLayout, setNavLayoutState] = useState<'sidebar' | 'topnav'>(initialNavLayout ?? 'sidebar');
    const [tabLayout, setTabLayoutState] = useState<'horizontal' | 'vertical'>(initialTabLayout ?? 'horizontal');

    // After hydration: close sidebar on small viewports so it doesn't block content
    useEffect(() => {
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, []);
    const pathname = usePathname();
    const router = useRouter();

    // Clear pending active tab when pathname catches up
    useEffect(() => {
        if (pendingActiveTab && pathname === pendingActiveTab) {
            setPendingActiveTab(null);
        }
    }, [pathname, pendingActiveTab]);

    const TABS_KEY = `tsf_tabs_${contextKey}`;
    const SCOPE_KEY = `tsf_view_scope_${contextKey}`;

    // Load tabs, viewScope, and scopeAccess from localStorage/cookies on mount
    useEffect(() => {
        setIsLoaded(false);
        const savedTabs = localStorage.getItem(TABS_KEY);
        if (savedTabs) {
            try {
                const parsed = JSON.parse(savedTabs);
                const uniqueTabs = parsed.reduce((acc: Tab[], current: Tab) => {
                    if (!acc.find(t => t.id === current.id)) {
                        acc.push(current);
                    }
                    return acc;
                }, []);
                setOpenTabs(uniqueTabs);
            } catch (e) {
                console.error("Failed to parse tabs", e);
                setOpenTabs([{ id: 'home', title: 'Home', path: '/home' }]);
            }
        } else {
            setOpenTabs([{ id: 'home', title: 'Home', path: '/home' }]);
        }

        const savedScope = localStorage.getItem(SCOPE_KEY);
        if (savedScope === 'OFFICIAL' || savedScope === 'INTERNAL') {
            setViewScope(savedScope);
        }

        // scopeAccess already initialized from initialScopeAccess prop (zero-flicker)
        // Just set viewScope if official-only access
        if (initialScopeAccess === 'official') {
            setViewScope('OFFICIAL');
        }

        // [LAYOUT MIGRATION] One-time promotion of localStorage → cookie.
        // Users who had preferences saved before cookies were introduced will have
        // the server send defaults (no cookie). On mount we detect this and apply
        // their saved localStorage value immediately — no reload needed.
        const lsNav = localStorage.getItem('tsf_nav_layout') as 'sidebar' | 'topnav' | null;
        if (lsNav && lsNav !== initialNavLayout) {
            setNavLayoutState(lsNav);
            document.cookie = `tsf_nav_layout=${lsNav}; path=/; max-age=31536000; SameSite=Lax`;
        }
        const lsTab = localStorage.getItem('tsf_tab_layout') as 'horizontal' | 'vertical' | null;
        if (lsTab && lsTab !== initialTabLayout) {
            setTabLayoutState(lsTab);
            document.cookie = `tsf_tab_layout=${lsTab}; path=/; max-age=31536000; SameSite=Lax`;
        }

        setIsLoaded(true);
    }, [contextKey, TABS_KEY, SCOPE_KEY]);

    // Save viewScope to localStorage and Cookies
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(SCOPE_KEY, viewScope);
        document.cookie = `tsf_view_scope=${viewScope}; path=/; max-age=31536000; SameSite=Lax`;
    }, [viewScope, isLoaded, SCOPE_KEY]);

    const setTabLayout = (layout: 'horizontal' | 'vertical') => {
        setTabLayoutState(layout);
        localStorage.setItem('tsf_tab_layout', layout);
        document.cookie = `tsf_tab_layout=${layout}; path=/; max-age=31536000; SameSite=Lax`;
    };

    const setNavLayout = (layout: 'sidebar' | 'topnav') => {
        setNavLayoutState(layout);
        localStorage.setItem('tsf_nav_layout', layout);
        document.cookie = `tsf_nav_layout=${layout}; path=/; max-age=31536000; SameSite=Lax`;
        // Close sidebar when switching to topnav
        if (layout === 'topnav') setSidebarOpen(false);
        else setSidebarOpen(true);
    };

    const handleSetViewScope = (scope: 'OFFICIAL' | 'INTERNAL') => {
        // If official-only access, cannot switch to internal
        if (scopeAccess === 'official' && scope === 'INTERNAL') return;
        // Write cookie BEFORE router.refresh() — the proxy reads it server-side
        // to set X-Scope header for Django. Writing it in useEffect is too late
        // (refresh fires before the effect runs → wrong scope sent to backend).
        document.cookie = `tsf_view_scope=${scope}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem(SCOPE_KEY, scope);
        setViewScope(scope);
        router.refresh();
    };

    // Toggle is visible only if user has internal (full) access
    const canToggleScope = scopeAccess === 'internal';

    // Save tabs to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        if (openTabs.length > 0) {
            localStorage.setItem(TABS_KEY, JSON.stringify(openTabs));
        }
    }, [openTabs, isLoaded, TABS_KEY]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const openTab = (title: string, path: string) => {
        const id = path;
        // Immediately mark this tab as active so UI updates before router.push finishes
        setPendingActiveTab(id);
        setOpenTabs(prev => {
            // Already open with same path — just navigate
            if (prev.find(t => t.id === id)) return prev;
            // Deduplicate by title: if a tab with same title exists, replace its path
            const existingByTitle = prev.findIndex(t => t.title === title);
            if (existingByTitle !== -1) {
                const updated = [...prev];
                updated[existingByTitle] = { id, title, path };
                return updated;
            }
            return [...prev, { id, title, path }];
        });
        router.push(path);
    };

    const closeTab = (id: string) => {
        const newTabs = openTabs.filter(t => t.id !== id);
        setOpenTabs(newTabs);
        if (pathname === id && newTabs.length > 0) {
            router.push(newTabs[newTabs.length - 1].path);
        } else if (newTabs.length === 0) {
            router.push('/home');
        }
    };

    const clearTabs = () => {
        setOpenTabs([{ id: 'home', title: 'Home', path: '/home' }]);
        router.push('/home');
    };

    const reorderTabs = (draggedId: string, targetId: string, position: 'before' | 'after') => {
        if (draggedId === targetId) return;
        setOpenTabs(prev => {
            const fromIdx = prev.findIndex(t => t.id === draggedId);
            const targetIdx = prev.findIndex(t => t.id === targetId);
            if (fromIdx === -1 || targetIdx === -1) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            // After splice the indices shift if we removed before the target.
            let insertAt = next.findIndex(t => t.id === targetId);
            if (insertAt === -1) return prev;
            if (position === 'after') insertAt += 1;
            next.splice(insertAt, 0, moved);
            return next;
        });
    };

    /** Replace the currently active tab with a new page (same position, no new tab) */
    const replaceTab = (title: string, path: string) => {
        const id = path;
        // Immediately mark this tab as active
        setPendingActiveTab(id);
        setOpenTabs(prev => {
            // If destination tab already exists, just navigate
            if (prev.find(t => t.id === id)) return prev;
            // Find the current active tab and replace it in-place
            const activeIdx = prev.findIndex(t => t.path === pathname);
            if (activeIdx !== -1) {
                const updated = [...prev];
                updated[activeIdx] = { id, title, path };
                return updated;
            }
            // Fallback: just add it
            return [...prev, { id, title, path }];
        });
        router.push(path);
    };

    return (
        <AdminContext.Provider value={{
            sidebarOpen,
            toggleSidebar,
            openTabs,
            activeTab: pendingActiveTab || pathname,
            openTab,
            replaceTab,
            closeTab,
            clearTabs,
            reorderTabs,
            viewScope,
            setViewScope: handleSetViewScope,
            scopeAccess,
            canToggleScope,
            navLayout,
            setNavLayout,
            tabLayout,
            setTabLayout,
        }}>
            {children}
        </AdminContext.Provider>
    );
}

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error('useAdmin must be used within AdminProvider');
    return context;
};
