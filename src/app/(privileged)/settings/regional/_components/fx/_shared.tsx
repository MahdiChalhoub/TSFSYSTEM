'use client'
/**
 * Shared FX primitives + helpers used by FxRedesigned and its sibling
 * sub-tab files (RevaluationsView, etc.).
 *
 * Kept deliberately small — only style helpers, theme tokens, micro-
 * components (Field/Pill/Th/Td/Kpi/ActionBtn/SectionHeader), and the
 * Period type. Anything bigger lives in its own file.
 */

import { useEffect, useState } from 'react'

/* ─── Style helpers / theme tokens ─────────────────────────────────── */

export const grad = (v: string) => ({
    background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))`,
})
export const soft = (v: string, p = 12) => ({
    backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)`,
})
/** Theme token w/ literal fallback for legacy themes. */
export const FG_PRIMARY = 'var(--app-primary-foreground, #fff)'

/** Normalize any thrown value into a short string for diagnostic display. */
export const msg = (e: unknown): string => {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    try { return JSON.stringify(e) } catch { return String(e) }
}

export const INPUT_CLS = 'px-2.5 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-app-primary/20 transition-all w-full font-mono'
export const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--app-background)',
    border: '1px solid var(--app-border)',
    color: 'var(--app-foreground)',
    fontSize: 12,
}

/* ─── Shared types ─────────────────────────────────────────────────── */

export type Period = {
    id: number
    name: string
    start_date: string
    end_date: string
    status: string
    fiscal_year: number
    fiscal_year_name?: string
}
export type FiscalYear = { id: number; name: string; periods: Period[] }

/* ─── Micro-components ─────────────────────────────────────────────── */

export function Th({ children, align }: { children: React.ReactNode; align?: 'right' | 'center' }) {
    return (
        <th className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest"
            style={{ color: 'var(--app-muted-foreground)', textAlign: align ?? 'left' }}>
            {children}
        </th>
    )
}

export function Td({ children, align }: { children: React.ReactNode; align?: 'right' | 'center' }) {
    return (
        <td className="px-3 py-1.5" style={{ textAlign: align ?? 'left', fontSize: 11 }}>
            {children}
        </td>
    )
}

export function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
    return (
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ ...soft(tone, 12), color: `var(${tone})` }}>{children}</span>
    )
}

export function Field({ label, hint, error, children }: {
    label: string; hint?: string; error?: boolean; children: React.ReactNode
}) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: error ? 'var(--app-error)' : 'var(--app-foreground)' }}>{label}</div>
            {children}
            {hint && <p className="mt-1 leading-tight"
                style={{ fontSize: 9, color: error ? 'var(--app-error)' : 'var(--app-muted-foreground)' }}>{hint}</p>}
        </div>
    )
}

/** Smooth-tween a numeric value with ease-out cubic. ~400 ms total — fast
 *  enough to feel snappy, slow enough to be visible. */
export function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
    const [display, setDisplay] = useState(value)
    useEffect(() => {
        const start = display
        const end = value
        if (Math.abs(end - start) < Math.pow(10, -decimals - 1)) {
            setDisplay(end)
            return
        }
        const duration = 400
        const t0 = performance.now()
        let raf = 0
        const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(start + (end - start) * eased)
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, decimals])
    return <>{display.toFixed(decimals)}</>
}

export function Kpi({ label, value, tone, icon }: {
    label: string; value: number | string; tone: string; icon: React.ReactNode
}) {
    const dim = value === 0 || value === '0' || value === '0.00'
    const numMatch = typeof value === 'number'
        ? { sign: '', n: value, decimals: 0, suffix: '' }
        : (() => {
            const s = String(value)
            const m = s.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/)
            if (!m) return null
            return { sign: m[1], n: Number(m[2]), decimals: (m[2].split('.')[1] ?? '').length, suffix: m[3] }
        })()
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={dim
                ? { background: 'transparent', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', opacity: 0.55 }
                : { ...soft(tone, 8), borderColor: `color-mix(in srgb, var(${tone}) 25%, transparent)` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ ...soft(tone, 14), color: `var(${tone})` }}>{icon}</div>
            <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest truncate"
                    style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                <div className="font-black tabular-nums leading-none mt-0.5"
                    style={{ fontSize: 14, color: dim ? 'var(--app-muted-foreground)' : `var(${tone})` }}>
                    {numMatch
                        ? <>{numMatch.sign}<AnimatedCounter value={numMatch.n} decimals={numMatch.decimals} />{numMatch.suffix}</>
                        : value}
                </div>
            </div>
        </div>
    )
}

export function ActionBtn({ icon, tone, filled, onClick, disabled, children, title }: {
    icon: React.ReactNode; tone: string; filled?: boolean
    onClick?: () => void; disabled?: boolean
    children: React.ReactNode; title?: string
}) {
    if (filled) {
        return (
            <button onClick={onClick} disabled={disabled} title={title}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                style={!disabled
                    ? { ...grad(tone), color: FG_PRIMARY, fontSize: 11, boxShadow: `0 4px 12px color-mix(in srgb, var(${tone}) 30%, transparent)` }
                    : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                {icon} {children}
            </button>
        )
    }
    return (
        <button onClick={onClick} disabled={disabled} title={title}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
                fontSize: 11,
                color: `var(${tone})`,
                borderColor: `color-mix(in srgb, var(${tone}) 30%, transparent)`,
                background: `color-mix(in srgb, var(${tone}) 6%, transparent)`,
            }}>
            {icon} {children}
        </button>
    )
}

export function SectionHeader({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode
}) {
    return (
        <div className="px-4 py-3 border-b border-app-border/50 flex items-center justify-between gap-3 shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
            <div className="min-w-0 flex-1">
                <div className="font-black uppercase tracking-widest flex items-center gap-2"
                    style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                    {icon}<span className="truncate">{title}</span>
                </div>
                {subtitle && <p className="mt-0.5 truncate"
                    style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}

/** Generic numeric-array sparkline. Used by Revaluations to plot net-impact
 *  over time. Tone is directional: green if rising, red if falling. */
export function NumericSparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.max(Math.abs(max), 1) * 0.001
    const W = 100, H = 24, P = 2
    const pts = values.map((v, i) => {
        const x = P + (i / (values.length - 1)) * (W - P * 2)
        const y = P + (1 - (v - min) / span) * (H - P * 2)
        return [x, y] as const
    })
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const trend = values[values.length - 1] - values[0]
    const tone = trend > 0 ? '--app-success' : trend < 0 ? '--app-error' : '--app-muted-foreground'
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-6">
            <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.6" fill={`var(${tone})`} />
        </svg>
    )
}
