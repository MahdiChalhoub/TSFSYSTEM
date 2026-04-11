'use client';

import { useAdmin, NEW_TAB_PREFIX } from '@/context/AdminContext';
import { Launchpad } from '@/components/admin/Launchpad';
import { TabNavigator } from '@/components/admin/TabNavigator';
import React, { Suspense } from 'react';

/**
 * ContentArea — manages tab layout (horizontal/vertical) and shows Launchpad for Quick Access tabs.
 * This is a client component that wraps the page children.
 */
export function ContentArea({ children }: { children: React.ReactNode }) {
    const { focusedTabId, tabLayout } = useAdmin();

    const isQuickAccess = focusedTabId.startsWith(NEW_TAB_PREFIX);
    const content = isQuickAccess ? <Launchpad /> : <>{children}</>;

    if (tabLayout === 'horizontal') {
        // Horizontal: TabNavigator above, content below
        return (
            <>
                <TabNavigator />
                <main className="flex-1 overflow-auto relative p-4 md:p-5 min-w-0">
                    {content}
                </main>
            </>
        );
    }

    // Vertical: content left, TabNavigator strip on the right
    return (
        <div className="flex-1 flex min-h-0">
            <main className="flex-1 overflow-auto relative p-4 md:p-5 min-w-0">
                {content}
            </main>
            <TabNavigator />
        </div>
    );
}
