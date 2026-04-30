'use client'

import { BarChart3 } from 'lucide-react'

export function LoadingSkeleton() {
    return (
        <div className="min-h-screen p-4 md:p-6 animate-in fade-in duration-300">
            {/* Header skeleton */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-9 h-9 rounded-xl bg-app-surface animate-pulse" />
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--app-primary-bg)', border: '1px solid var(--app-primary-border)' }}>
                    <BarChart3 size={26} style={{ color: 'var(--app-primary)', opacity: 0.4 }} />
                </div>
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-32 rounded bg-app-surface animate-pulse" />
                    <div className="h-6 w-60 rounded-lg bg-app-surface animate-pulse" />
                    <div className="h-3 w-80 rounded bg-app-surface animate-pulse" />
                </div>
            </div>

            {/* KPI strip skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }} className="mb-5">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-2 px-3 py-3 rounded-xl animate-pulse"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg bg-app-surface" />
                        <div className="space-y-1.5 flex-1">
                            <div className="h-2 w-10 rounded bg-app-surface" />
                            <div className="h-4 w-8 rounded bg-app-surface" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Two pane layout skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-10 rounded-xl animate-pulse"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)' }} />
                    ))}
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-2xl animate-pulse"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)' }} />
                    ))}
                </div>
            </div>
        </div>
    )
}
