'use client';

import { Suspense } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { TabNavigator } from './TabNavigator';

/**
 * Suspense fallback for the page area.
 *
 * Returns null so router.refresh() (e.g. scope toggle) doesn't flash a
 * dark animate-pulse skeleton against the dark theme — the previous
 * children stay rendered until React swaps in the new tree.
 *
 * Pages that need a richer placeholder should ship a route-level loading.tsx.
 */
function PageSkeleton() {
    return null;
}

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
                <main className="flex-1 flex flex-col min-h-0 overflow-auto relative">
                    <Suspense fallback={<PageSkeleton />}>
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
            <main className="flex-1 flex flex-col min-h-0 overflow-auto relative">
                <Suspense fallback={<PageSkeleton />}>
                    {children}
                </Suspense>
            </main>
        </>
    );
}
