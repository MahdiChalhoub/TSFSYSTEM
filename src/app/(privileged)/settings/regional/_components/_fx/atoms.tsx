'use client'
/**
 * FX Management — small reusable UI atoms.
 * Extracted verbatim from FxRedesigned.tsx so sub-modules can share them.
 */
import React from 'react'
import { soft } from '../fx/_shared'

/** Single column in the BID / MID / ASK trio shown on a policy card. The
 *  `pending` flag styles previewed (not-yet-written-to-DB) values with a
 *  dashed underline so the operator knows to sync. */
export function RateColumn({ side, tone, sub, rate, pending, primary }: {
    side: 'BID' | 'MID' | 'ASK'
    tone: string
    sub: string
    rate: number | null
    pending: boolean
    primary?: boolean
}) {
    return (
        <div className="text-center">
            <div className="font-black uppercase tracking-widest mb-0.5"
                style={{ fontSize: 8, color: `var(${tone})` }}>
                {side} <span className="text-app-muted-foreground font-mono">· {sub}</span>
            </div>
            <div className="font-mono font-black tabular-nums leading-none"
                style={{
                    fontSize: primary ? 18 : 14,
                    color: rate === null ? 'var(--app-muted-foreground)' : 'var(--app-foreground)',
                    textDecoration: pending ? 'underline dashed' : 'none',
                    textDecorationColor: pending ? `var(--app-warning)` : undefined,
                    textUnderlineOffset: 3,
                }}
                title={pending ? 'Previewed from spread — sync to commit' : undefined}>
                {rate === null ? '—' : rate.toFixed(primary ? 6 : 4)}
            </div>
        </div>
    )
}

export function MenuItem({ icon, label, tone, onClick, disabled }: {
    icon: React.ReactNode; label: string; tone?: string; onClick: () => void; disabled?: boolean
}) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full text-left px-3 py-1.5 inline-flex items-center gap-2 hover:bg-app-background disabled:opacity-50"
            style={{ fontSize: 11, color: tone ? `var(${tone})` : 'var(--app-foreground)' }}>
            {icon} {label}
        </button>
    )
}

export function PanelGroup({ tone, title, hint, children }: { tone: string; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl p-3 space-y-2"
            style={{ background: `color-mix(in srgb, var(${tone}) 4%, transparent)`, border: `1px solid color-mix(in srgb, var(${tone}) 18%, transparent)` }}>
            <div className="flex items-center gap-1.5">
                <span className="font-black uppercase tracking-widest"
                    style={{ fontSize: 9, color: `var(${tone})` }}>{title}</span>
                {hint && <span className="text-app-muted-foreground" style={{ fontSize: 9 }}>— {hint}</span>}
            </div>
            {children}
        </div>
    )
}

export function PrefixInput({ tone, prefix, suffix, value, onChange, valid, placeholder }: {
    tone: string; prefix: string; suffix: string; value: string; onChange: (v: string) => void; valid: boolean; placeholder?: string
}) {
    return (
        <div className="flex items-stretch rounded-lg overflow-hidden border"
            style={valid
                ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
            <span className="px-3 flex items-center font-mono font-black"
                style={{ fontSize: 12, background: `color-mix(in srgb, var(${tone}) 8%, transparent)`, borderRight: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                {prefix}
            </span>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                inputMode="decimal"
                className="flex-1 px-2 py-1.5 outline-none bg-transparent font-mono tabular-nums"
                style={{ fontSize: 12, color: 'var(--app-foreground)' }} />
            {suffix && (
                <span className="px-3 flex items-center font-mono font-black"
                    style={{ fontSize: 12, background: `color-mix(in srgb, var(${tone}) 8%, transparent)`, borderLeft: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                    {suffix}
                </span>
            )}
        </div>
    )
}

export function SegSelect<T extends string>({ title, options, value, onChange }: {
    title: string
    options: Array<{ key: T; label: string; tone?: string }>
    value: T
    onChange: (v: T) => void
}) {
    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border bg-app-surface" title={title}
            style={{ borderColor: 'var(--app-border)' }}>
            {options.map(opt => {
                const active = value === opt.key
                return (
                    <button key={opt.key} onClick={() => onChange(opt.key)}
                        className="px-2 py-1 rounded-md font-bold transition-all"
                        style={active && opt.tone
                            ? { ...soft(opt.tone, 18), color: `var(${opt.tone})`, fontSize: 10 }
                            : active
                                ? { background: 'var(--app-foreground)', color: 'var(--app-background)', fontSize: 10 }
                                : { color: 'var(--app-muted-foreground)', fontSize: 10 }}>
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/** Skeleton mirrors the real layout (KPI strip + toolbar + 4 card placeholders)
 *  so the page doesn't pop during initial load. Uses `.animate-pulse` for
 *  the shimmer effect — single Tailwind class, no JS. */
export function FxSkeleton() {
    const ph = (h: string, w?: string) => ({
        height: h,
        width: w ?? '100%',
        background: 'color-mix(in srgb, var(--app-foreground) 8%, transparent)',
        borderRadius: 6,
    })
    return (
        <div className="space-y-3 animate-pulse">
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div style={ph('8px', '70%')} />
                        <div className="mt-1.5" style={ph('14px', '40%')} />
                    </div>
                ))}
            </div>
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <div style={{ ...ph('30px', '220px'), flex: 1 }} />
                <div style={ph('30px', '120px')} />
                <div style={ph('30px', '120px')} />
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-4 border space-y-2" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                        <div className="flex items-center gap-2">
                            <div style={ph('8px', '8px')} />
                            <div style={ph('12px', '40%')} />
                        </div>
                        <div style={ph('22px', '60%')} />
                        <div style={ph('10px', '80%')} />
                        <div style={ph('28px', '100%')} />
                        <div className="flex gap-2 mt-1">
                            <div style={ph('20px', '60px')} />
                            <div style={ph('20px', '40px')} />
                            <div className="flex-1" />
                            <div style={ph('20px', '60px')} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function EmptyState({ icon, title, hint, cta }: { icon: React.ReactNode; title: string; hint?: string; cta?: React.ReactNode }) {
    return (
        <div className="bg-app-surface rounded-2xl border border-app-border/50 py-10 text-center">
            <div className="flex justify-center">{icon}</div>
            <p className="font-bold mt-2"
                style={{ fontSize: 11, color: 'var(--app-foreground)' }}>{title}</p>
            {hint && <p className="mt-1 max-w-md mx-auto leading-relaxed"
                style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{hint}</p>}
            {cta}
        </div>
    )
}
