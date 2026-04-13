'use client';

import { Suspense } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { TabNavigator } from './TabNavigator';

/**
 * Client wrapper that owns the tab-layout decision:
 * - horizontal: strip on top, main content below
 * - vertical:   narrow rail on RIGHT, main content to the left
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
    const { tabLayout } = useAdmin();

    if (tabLayout === 'vertical') {
        return (
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <main className="flex-1 overflow-auto relative p-6 md:p-8">
                    <Suspense fallback={null}>
                        {children}
                    </Suspense>
                </main>
                <TabNavigator />
            </div>
        );
    }

    return (
        <>
            <TabNavigator />
            <main className="flex-1 overflow-auto relative p-6 md:p-8">
                <Suspense fallback={null}>
                    {children}
                </Suspense>
            </main>
        </>
    );
}
