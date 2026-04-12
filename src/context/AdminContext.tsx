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
    closeTab: (id: string) => void;
    clearTabs: () => void;
    viewScope: 'OFFICIAL' | 'INTERNAL';
    setViewScope: (scope: 'OFFICIAL' | 'INTERNAL') => void;
    /** Which access level the user was granted at login */
    scopeAccess: ScopeAccess;
    /** Whether the scope toggle should be visible (only in 'internal' access mode) */
    canToggleScope: boolean;
    /** Navigation layout: vertical sidebar or horizontal top-nav */
    navLayout: 'sidebar' | 'topnav';
    setNavLayout: (layout: 'sidebar' | 'topnav') => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children, contextKey = 'default', initialScopeAccess }: { children: React.ReactNode, contextKey?: string, initialScopeAccess?: 'official' | 'internal' | null }) {
    // Start open on desktop, closed on mobile — avoids the fixed-overlay blocking content
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [viewScope, setViewScope] = useState<'OFFICIAL' | 'INTERNAL'>('INTERNAL');
    const [isLoaded, setIsLoaded] = useState(false);
    // Initialize from server prop so SSR and first client render match — no pop-in flash
    const [scopeAccess, setScopeAccess] = useState<ScopeAccess>(initialScopeAccess ?? null);
    const [navLayout, setNavLayoutState] = useState<'sidebar' | 'topnav'>(() => {
        if (typeof window === 'undefined') return 'sidebar';
        return (localStorage.getItem('tsf_nav_layout') as 'sidebar' | 'topnav') || 'sidebar';
    });

    // After hydration: close sidebar on small viewports so it doesn't block content
    useEffect(() => {
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, []);
    const pathname = usePathname();
    const router = useRouter();

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

        setIsLoaded(true);
    }, [contextKey, TABS_KEY, SCOPE_KEY]);

    // Save viewScope to localStorage and Cookies
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(SCOPE_KEY, viewScope);
        document.cookie = `tsf_view_scope=${viewScope}; path=/; max-age=31536000; SameSite=Lax`;
    }, [viewScope, isLoaded, SCOPE_KEY]);

    const setNavLayout = (layout: 'sidebar' | 'topnav') => {
        setNavLayoutState(layout);
        localStorage.setItem('tsf_nav_layout', layout);
        // Close sidebar when switching to topnav
        if (layout === 'topnav') setSidebarOpen(false);
        else setSidebarOpen(true);
    };

    const handleSetViewScope = (scope: 'OFFICIAL' | 'INTERNAL') => {
        // If official-only access, cannot switch to internal
        if (scopeAccess === 'official' && scope === 'INTERNAL') return;
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

    return (
        <AdminContext.Provider value={{
            sidebarOpen,
            toggleSidebar,
            openTabs,
            activeTab: pathname,
            openTab,
            closeTab,
            clearTabs,
            viewScope,
            setViewScope: handleSetViewScope,
            scopeAccess,
            canToggleScope,
            navLayout,
            setNavLayout,
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
