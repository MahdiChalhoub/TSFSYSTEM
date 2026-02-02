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
    viewScope: 'OFFICIAL' | 'INTERNAL';
    setViewScope: (scope: 'OFFICIAL' | 'INTERNAL') => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [viewScope, setViewScope] = useState<'OFFICIAL' | 'INTERNAL'>('INTERNAL');
    const pathname = usePathname();
    const router = useRouter();

    // Load tabs and viewScope from localStorage on mount
    useEffect(() => {
        const savedTabs = localStorage.getItem('tsf_tabs');
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
            setOpenTabs([{ id: 'dashboard', title: 'Dashboard', path: '/admin' }]);
        }

        const savedScope = localStorage.getItem('tsf_view_scope');
        if (savedScope === 'OFFICIAL' || savedScope === 'INTERNAL') {
            setViewScope(savedScope);
        }
    }, []);

    // Save viewScope to localStorage and Cookies
    useEffect(() => {
        localStorage.setItem('tsf_view_scope', viewScope);
        // Set cookie for server-side awareness (valid for 1 year)
        document.cookie = `tsf_view_scope=${viewScope}; path=/; max-age=31536000; SameSite=Lax`;
    }, [viewScope]);

    const handleSetViewScope = (scope: 'OFFICIAL' | 'INTERNAL') => {
        setViewScope(scope);
        // Trigger server components refresh
        router.refresh();
    };

    // Save tabs to localStorage
    useEffect(() => {
        if (openTabs.length > 0) {
            localStorage.setItem('tsf_tabs', JSON.stringify(openTabs));
        }
    }, [openTabs]);

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
            router.push('/admin'); // Fallback
        }
    };

    return (
        <AdminContext.Provider value={{
            sidebarOpen,
            toggleSidebar,
            openTabs,
            activeTab: pathname,
            openTab,
            closeTab,
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
