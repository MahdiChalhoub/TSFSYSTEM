'use client';

import { Suspense } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { useScope } from '@/hooks/useScope';
import { TabNavigator } from './TabNavigator';

/**
 * Persistent scope badge — always visible so the user knows which view they're in.
 * Only shown when both scopes are accessible (internal-access users who can toggle).
 */
function ScopeBadge() {
    const { isOfficial, isInternal, canToggleScope } = useScope();

    // Official-only users always see Official data — no need to show a badge
    if (!canToggleScope) return null;

    return (
        <div
            className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg border"
            style={isOfficial ? {
                background: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#10b981',
            } : {
                background: 'rgba(99, 102, 241, 0.12)',
                borderColor: 'rgba(99, 102, 241, 0.35)',
                color: '#818cf8',
            }}
        >
            <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: isOfficial ? '#10b981' : '#818cf8' }}
            />
            {isOfficial ? 'Official View' : 'Internal View'}
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
                <main className="flex-1 overflow-auto relative p-6 md:p-8">
                    <Suspense fallback={null}>
                        {children}
                    </Suspense>
                </main>
                <TabNavigator />
                <ScopeBadge />
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
            <ScopeBadge />
        </>
    );
}
