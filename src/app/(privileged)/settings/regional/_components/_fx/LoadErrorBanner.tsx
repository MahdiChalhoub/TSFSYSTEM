'use client'
/**
 * FX Management — load-failure diagnostic banner.
 * Extracted verbatim from FxRedesigned.tsx so the orchestrator stays slim.
 */
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { grad, FG_PRIMARY } from '../fx/_shared'

export function LoadErrorBanner({ loadErrors, onRetry, onDismiss }: {
    loadErrors: Record<string, string>
    onRetry: () => void
    onDismiss: () => void
}) {
    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--app-surface)', border: '1.5px solid color-mix(in srgb, var(--app-error) 40%, transparent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-error) 12%, transparent)' }}>
            {/* Header strip */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap"
                style={{ background: 'color-mix(in srgb, var(--app-error) 14%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                <div className="inline-flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'var(--app-error)', color: FG_PRIMARY }}>
                        <AlertTriangle size={14} />
                    </div>
                    <div>
                        <div className="font-black uppercase tracking-widest" style={{ fontSize: 11, color: 'var(--app-error)' }}>
                            {Object.keys(loadErrors).length} data fetch{Object.keys(loadErrors).length === 1 ? '' : 'es'} failed
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                            Open the browser console (F12) to copy the full traces.
                        </div>
                    </div>
                </div>
                <div className="inline-flex items-center gap-1">
                    <button onClick={onRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all"
                        style={{ fontSize: 11, color: FG_PRIMARY, ...grad('--app-error'), boxShadow: '0 4px 12px color-mix(in srgb, var(--app-error) 30%, transparent)' }}>
                        <RefreshCcw size={11} /> Retry
                    </button>
                    <button onClick={onDismiss}
                        title="Hide this banner without retrying"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all border"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Dismiss
                    </button>
                </div>
            </div>
            {/* Per-endpoint error list */}
            <ul className="p-3 space-y-1.5">
                {Object.entries(loadErrors).map(([endpoint, message]) => (
                    <li key={endpoint}
                        className="rounded-md px-2.5 py-1.5"
                        style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                        <div className="font-mono font-black uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--app-error)' }}>
                            {endpoint}
                        </div>
                        <div className="font-mono mt-0.5 break-words" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                            {message}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
