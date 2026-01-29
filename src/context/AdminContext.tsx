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
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const pathname = usePathname();
    const router = useRouter();

    // Load tabs from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('tsf_tabs');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Deduplicate loaded tabs
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
            // Default Dashboard tab
            setOpenTabs([{ id: 'dashboard', title: 'Dashboard', path: '/admin' }]);
        }
    }, []);

    // Sync active tab with URL
    useEffect(() => {
        // If current path isn't in openTabs, we could add it automatically? 
        // For now, we trust the 'openTab' call to add it.
    }, [pathname]);

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
        <AdminContext.Provider value={{ sidebarOpen, toggleSidebar, openTabs, activeTab: pathname, openTab, closeTab }}>
            {children}
        </AdminContext.Provider>
    );
}

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error('useAdmin must be used within AdminProvider');
    return context;
};
