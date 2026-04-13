'use client';

import { Suspense } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { TabNavigator } from './TabNavigator';

/**
 * Shown while the active page component is loading (Suspense boundary).
 * Uses CSS variables so it respects the active theme automatically.
 */
function PageSkeleton() {
    return (
        <div className="flex-1 overflow-auto p-6 md:p-8">
            <div className="animate-pulse space-y-4 max-w-5xl">
                {/* Page title */}
                <div className="h-7 rounded-lg w-48" style={{ background: 'var(--app-surface)' }} />
                <div className="h-4 rounded w-72" style={{ background: 'var(--app-surface)' }} />

                {/* Stat cards row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 rounded-xl" style={{ background: 'var(--app-surface)' }} />
                    ))}
                </div>

                {/* Table / content block */}
                <div className="h-64 rounded-xl mt-2" style={{ background: 'var(--app-surface)' }} />
            </div>
        </div>
    );
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
                <main className="flex-1 overflow-auto relative">
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
            <main className="flex-1 overflow-auto relative">
                <Suspense fallback={<PageSkeleton />}>
                    {children}
                </Suspense>
            </main>
        </>
    );
}
