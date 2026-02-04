'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Tab = {
    id: string;
    title: string;
    path: string;
};

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
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children, contextKey = 'default' }: { children: React.ReactNode, contextKey?: string }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [viewScope, setViewScope] = useState<'OFFICIAL' | 'INTERNAL'>('INTERNAL');
    const [isLoaded, setIsLoaded] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const TABS_KEY = `tsf_tabs_${contextKey}`;
    const SCOPE_KEY = `tsf_view_scope_${contextKey}`;

    // Load tabs and viewScope from localStorage on contextKey change or mount
    useEffect(() => {
        setIsLoaded(false); // Reset load state while switching
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
                setOpenTabs([{ id: 'dashboard', title: 'Dashboard', path: '/admin' }]);
            }
        } else {
            // Default tabs per context
            const defaultPath = contextKey === 'saas' ? '/saas/dashboard' : '/admin';
            setOpenTabs([{ id: 'dashboard', title: 'Dashboard', path: defaultPath }]);
        }

        const savedScope = localStorage.getItem(SCOPE_KEY);
        if (savedScope === 'OFFICIAL' || savedScope === 'INTERNAL') {
            setViewScope(savedScope);
        }
        setIsLoaded(true);
    }, [contextKey, TABS_KEY, SCOPE_KEY]);

    // Save viewScope to localStorage and Cookies
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(SCOPE_KEY, viewScope);
        // Set cookie for server-side awareness (valid for 1 year)
        document.cookie = `tsf_view_scope=${viewScope}; path=/; max-age=31536000; SameSite=Lax`;
    }, [viewScope, isLoaded, SCOPE_KEY]);

    const handleSetViewScope = (scope: 'OFFICIAL' | 'INTERNAL') => {
        setViewScope(scope);
        // Trigger server components refresh
        router.refresh();
    };

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
            if (prev.find(t => t.id === id)) return prev;
            return [...prev, { id, title, path }];
        });

        router.push(path);
    };

    const closeTab = (id: string) => {
        const newTabs = openTabs.filter(t => t.id !== id);
        setOpenTabs(newTabs);

        // If we closed the active tab, navigate to the last one
        if (pathname === id && newTabs.length > 0) {
            router.push(newTabs[newTabs.length - 1].path);
        } else if (newTabs.length === 0) {
            const defaultPath = contextKey === 'saas' ? '/saas/dashboard' : '/admin';
            router.push(defaultPath); // Fallback
        }
    };

    const clearTabs = () => {
        const defaultPath = contextKey === 'saas' ? '/saas/dashboard' : '/admin';
        setOpenTabs([{ id: 'dashboard', title: 'Dashboard', path: defaultPath }]);
        router.push(defaultPath);
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
            setViewScope: handleSetViewScope
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
