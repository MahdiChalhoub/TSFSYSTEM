'use client';

import { useAdmin } from '@/context/AdminContext';
import { TabNavigator } from '@/components/admin/TabNavigator';
import React, { Suspense } from 'react';

/**
 * ContentArea — manages tab layout and shows content for the active tab.
 * This is a client component that wraps the page children.
 */
export function ContentArea({ children }: { children: React.ReactNode }) {
    const { activeTab } = useAdmin();
    void activeTab; // used to re-render on tab changes

    return (
        <>
            <TabNavigator />
            <main className="flex-1 overflow-auto relative p-4 md:p-5 min-w-0">
                {children}
            </main>
        </>
    );
}
