'use client'

import { ShieldCheck, ShieldAlert } from 'lucide-react'
import type { Currency } from '@/app/actions/finance/currency'
import { grad, soft, HEALTH_COLOR, HEALTH_LABEL } from './constants'

/* ─── Reusable layout helpers (theme-aligned) ───────────────────────── */

export function SectionHeader({ icon, title, subtitle, action }: {
    icon: React.ReactNode
    title: string
    subtitle?: string
    action?: React.ReactNode
}) {
    return (
        <div className="px-4 py-3 border-b border-app-border/50 flex items-center justify-between gap-3 shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
            <div className="min-w-0 flex-1">
                <div className="font-black uppercase tracking-widest text-app-foreground flex items-center gap-2"
                     style={{ fontSize: 11, lineHeight: 1.3 }}>
                    {icon}<span className="truncate">{title}</span>
                </div>
                {subtitle && <p className="text-app-muted-foreground mt-0.5 truncate" style={{ fontSize: 9, lineHeight: 1.3 }}>{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}

export function PrimaryButton({ children, onClick, disabled, title, colorVar }: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    title?: string
    colorVar: string
}) {
    return (
        <button onClick={onClick} disabled={disabled} title={title}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={!disabled
                ? { ...grad(colorVar), color: 'var(--app-primary-foreground, #fff)', boxShadow: `0 4px 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)` }
                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
            {children}
        </button>
    )
}

export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="py-10 text-center">
            <div className="flex justify-center">{icon}</div>
            <p className="text-[11px] font-bold text-app-foreground mt-2">{title}</p>
            {hint && <p className="text-[9px] text-app-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{hint}</p>}
        </div>
    )
}

export function SyncStatusBadge({ status, when, error }: { status: string | null; when: string; error?: string | null }) {
    const colorVar =
        status === 'OK' ? '--app-success'
        : status === 'FAIL' ? '--app-error'
        : '--app-muted-foreground'
    return (
        <span title={error ?? ''} className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${colorVar})` }} />
            <span className="font-mono text-[10px]" style={{ color: `var(${colorVar})` }}>
                {status} · {new Date(when).toLocaleString()}
            </span>
        </span>
    )
}

export function HealthPill({ label, value, color, icon }: {
    label: string; value: number; color: string; icon: React.ReactNode
}) {
    const dim = value === 0
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
            style={dim
                ? { background: 'transparent', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', opacity: 0.55 }
                : { ...soft(color, 8), border: `1px solid color-mix(in srgb, var(${color}) 25%, transparent)` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ ...soft(color, 14), color: `var(${color})` }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest text-app-muted-foreground truncate">{label}</div>
                <div className="text-[14px] font-black tabular-nums leading-none mt-0.5"
                    style={{ color: dim ? 'var(--app-muted-foreground)' : `var(${color})` }}>{value}</div>
            </div>
        </div>
    )
}

/** Sync-time badge that uses the *health-derived* color (not just the raw
 *  status) — a 5-day-old "OK" reads as warning, not green. */
export function FreshSyncBadge({ health, status, when, error }: {
    health: 'fresh' | 'stale' | 'fail' | 'never' | 'manual'
    status: string | null
    when: string
    error?: string | null
}) {
    const colorVar = HEALTH_COLOR[health]
    const ageH = (Date.now() - new Date(when).getTime()) / 36e5
    const ageLabel = ageH < 1 / 60 ? 'just now'
        : ageH < 1 ? `${Math.max(1, Math.round(ageH * 60))}m ago`
        : ageH < 48 ? `${Math.round(ageH)}h ago`
        : `${Math.round(ageH / 24)}d ago`
    return (
        <span title={error ?? HEALTH_LABEL[health]}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md whitespace-nowrap"
            style={{
                ...soft(colorVar, 10),
                border: `1px solid color-mix(in srgb, var(${colorVar}) 25%, transparent)`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(${colorVar})` }} />
            <span className="font-black uppercase tracking-wider" style={{ color: `var(${colorVar})`, fontSize: 9 }}>
                {status ?? '—'}
            </span>
            <span className="opacity-50" style={{ color: `var(${colorVar})`, fontSize: 9 }}>·</span>
            <span className="font-mono" style={{ color: `var(${colorVar})`, fontSize: 9 }}>
                {ageLabel}
            </span>
        </span>
    )
}

export function BasePill({ base }: { base?: Currency }) {
    if (!base) {
        return (
            <a href="?tab=currencies"
                title="Click to open the Currencies tab and mark one as ⭐ default"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:brightness-110 transition-all"
                style={{ ...soft('--app-warning', 12), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                <ShieldAlert size={10} /> Set base →
            </a>
        )
    }
    return (
        <a href="?tab=currencies"
            title={`Base = ${base.code}. Click to change it in the Currencies tab.`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:brightness-110 transition-all"
            style={{ ...soft('--app-success', 12), color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 25%, transparent)' }}>
            <ShieldCheck size={10} /> Base: <span className="font-mono font-black">{base.code}</span>
        </a>
    )
}

export function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</span>
            {children}
        </div>
    )
}
