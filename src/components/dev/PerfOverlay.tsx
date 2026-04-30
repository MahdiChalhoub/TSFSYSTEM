'use client'

/**
 * Dev-only Perf Overlay
 * =====================
 * Floating bottom-right widget that shows the last few timed actions.
 * Slow ones (>800ms) flash red. Renders nothing in production builds.
 *
 * Mount once in the root layout; it listens for `tsf:perf-sample` window
 * events emitted by `runTimed()` / `<TimedButton>`.
 */
import { useEffect, useState } from 'react'
import type { PerfSample } from '@/lib/perf-timing'
import { Activity, ChevronDown, ChevronUp, X } from 'lucide-react'

const SLOW_MS = 800
const MAX_KEEP = 12

export function PerfOverlay() {
    const [samples, setSamples] = useState<PerfSample[]>([])
    const [collapsed, setCollapsed] = useState(true)
    const [hidden, setHidden] = useState(false)

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return
        const handler = (e: Event) => {
            const sample = (e as CustomEvent<PerfSample>).detail
            setSamples(prev => [sample, ...prev].slice(0, MAX_KEEP))
            // Auto-uncollapse for slow ones so the engineer sees it
            if (sample.durationMs >= SLOW_MS) setCollapsed(false)
        }
        window.addEventListener('tsf:perf-sample', handler as EventListener)
        return () => window.removeEventListener('tsf:perf-sample', handler as EventListener)
    }, [])

    if (process.env.NODE_ENV !== 'development') return null
    if (hidden) return null
    if (samples.length === 0 && collapsed) return null

    const slowCount = samples.filter(s => s.durationMs >= SLOW_MS).length
    const lastSlow = samples.find(s => s.durationMs >= SLOW_MS)

    return (
        <div className="fixed bottom-3 right-3 z-[9999] text-[11px] font-mono select-none"
             style={{ pointerEvents: 'auto' }}>
            <div className="rounded-lg shadow-2xl overflow-hidden"
                 style={{
                     background: 'rgba(15, 23, 42, 0.95)',
                     color: '#e2e8f0',
                     border: '1px solid rgba(148, 163, 184, 0.2)',
                     minWidth: 240,
                     maxWidth: 380,
                 }}>
                <button
                    type="button"
                    onClick={() => setCollapsed(c => !c)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/5"
                    style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(148, 163, 184, 0.15)' }}>
                    <Activity size={11} style={{ color: slowCount > 0 ? '#f87171' : '#4ade80' }} />
                    <span className="flex-1 text-left font-bold">
                        Perf {slowCount > 0 ? `· ${slowCount} slow` : `· ${samples.length}`}
                    </span>
                    {lastSlow && collapsed && (
                        <span className="opacity-70 truncate" style={{ maxWidth: 160 }}>
                            {lastSlow.label} {lastSlow.durationMs}ms
                        </span>
                    )}
                    {collapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setHidden(true) }}
                        className="opacity-50 hover:opacity-100 cursor-pointer"
                        title="Hide for this session">
                        <X size={10} />
                    </span>
                </button>
                {!collapsed && (
                    <div className="max-h-64 overflow-auto">
                        {samples.length === 0 ? (
                            <div className="px-2.5 py-2 opacity-60">
                                Waiting for the first timed action…
                            </div>
                        ) : (
                            samples.map((s, i) => {
                                const slow = s.durationMs >= SLOW_MS
                                return (
                                    <div key={i} className="px-2.5 py-1 flex items-center gap-2"
                                         style={{
                                             borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                                             background: slow ? 'rgba(248, 113, 113, 0.08)' : 'transparent',
                                         }}>
                                        <span className="tabular-nums w-12 text-right"
                                              style={{ color: slow ? '#f87171' : s.success ? '#4ade80' : '#fbbf24' }}>
                                            {s.durationMs}ms
                                        </span>
                                        <span className="flex-1 truncate" title={s.label}>{s.label}</span>
                                        {!s.success && <span style={{ color: '#fbbf24' }}>err</span>}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
