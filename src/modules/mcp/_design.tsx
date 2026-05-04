'use client'

/**
 * AI / MCP Design Primitives
 * ============================================================
 * Shared layout pieces every page in this module reuses, conformant
 * to .agents/workflows/design-language.md ("Dajingo Pro"):
 *
 *   - <ModulePage>      → page wrapper with the canonical h-full + p-4 md:p-6 + animate-in fade-in
 *   - <PageHeader>      → page-header-icon glow + text-lg md:text-xl black title + uppercase subtitle
 *   - <KPIStrip>        → adaptive grid (auto-fit minmax 140px) of compact stat tiles
 *   - <NavTile>         → tile with icon-box, title, copy, arrow — used on the dashboard
 *   - <EmptyState>      → standardised "no items" panel
 *   - <Loading>         → standardised spinner
 *   - <SectionCard>     → bordered surface used for "recent X" / "what's next" lists
 *
 * Every primitive uses CSS tokens (`var(--app-*)`) rather than raw hex
 * or Tailwind palette classes — so every page automatically picks up
 * the active theme (light, dark, branded) from the theme engine.
 *
 * Implementation rules followed:
 *   - NO raw hex (no `bg-purple-500`, `text-gray-900`, etc.)
 *   - NO hardcoded grid-cols-N — every grid uses `auto-fit minmax(N, 1fr)`
 *   - NO linear gradients on header icons (flat `bg-app-primary` only)
 *   - NO oversized titles (`text-lg md:text-xl` cap on H1)
 *   - NO sub-9px text outside badges/labels
 *   - YES `page-header-icon` global class for the glow
 *   - YES `custom-scrollbar`, `animate-in`, mandatory empty/loading states
 */

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/** Page wrapper. Conforms to design-language §1. */
export function ModulePage({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all max-h-[calc(100vh-8rem)]">
            {children}
        </div>
    )
}

/** Standard page header — icon glow + title + uppercase subtitle + optional actions. */
export function PageHeader({
    icon,
    title,
    subtitle,
    actions,
}: {
    icon: ReactNode
    title: string
    subtitle?: string
    actions?: ReactNode
}) {
    return (
        <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="page-header-icon bg-app-primary"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight truncate">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest truncate">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {actions}
                </div>
            )}
        </div>
    )
}

/** Ghost button (border, hover-tinted) — for secondary header actions. */
export function GhostButton({
    icon, label, onClick, href, disabled,
}: {
    icon?: ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean
}) {
    const className = 'flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50'
    if (href) {
        return <a href={href} className={className}>{icon}<span className="hidden md:inline">{label}</span></a>
    }
    return (
        <button onClick={onClick} disabled={disabled} className={className}>
            {icon}
            <span className="hidden md:inline">{label}</span>
        </button>
    )
}

/** Primary CTA button — solid app-primary with glow shadow. */
export function PrimaryButton({
    icon, label, onClick, href, disabled,
}: {
    icon?: ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean
}) {
    const className = 'flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50'
    const style = { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }
    if (href) {
        return <a href={href} className={className} style={style}>{icon}<span className="hidden sm:inline">{label}</span></a>
    }
    return (
        <button onClick={onClick} disabled={disabled} className={className} style={style}>
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    )
}

/** KPI tile data shape — `color` accepts a CSS variable string. */
export type KPI = {
    label: string
    value: string | number
    icon: ReactNode
    /** A CSS variable expression like `var(--app-primary)` or `var(--app-info)`. Not raw hex. */
    color?: string
    href?: string
    onClick?: () => void
    isActive?: boolean
}

/** Adaptive KPI strip — auto-fit minmax(140px, 1fr). Conforms to §3 + §4. */
export function KPIStrip({ items }: { items: KPI[] }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}
            className="mb-4 flex-shrink-0">
            {items.map(s => {
                const c = s.color ?? 'var(--app-primary)'
                const interactive = s.href || s.onClick
                const Wrap = ({ children }: { children: ReactNode }) =>
                    s.href
                        ? <a href={s.href} className="block">{children}</a>
                        : <button type="button" onClick={s.onClick} className="text-left w-full">{children}</button>
                const tile = (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                        style={{
                            background: s.isActive
                                ? `color-mix(in srgb, ${c} 15%, transparent)`
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: `1px solid color-mix(in srgb, ${s.isActive ? c : 'var(--app-border)'} ${s.isActive ? '50' : '50'}%, transparent)`,
                            cursor: interactive ? 'pointer' : 'default',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${c} 10%, transparent)`, color: c }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider truncate"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {s.label}
                            </div>
                            <div className="text-sm font-black text-app-foreground tabular-nums truncate">
                                {s.value}
                            </div>
                        </div>
                    </div>
                )
                return interactive ? <Wrap key={s.label}>{tile}</Wrap> : <div key={s.label}>{tile}</div>
            })}
        </div>
    )
}

/** Navigation tile used on the dashboard — icon box + title + caption + arrow. */
export function NavTile({
    icon, title, caption, href, color = 'var(--app-primary)',
}: {
    icon: ReactNode
    title: string
    caption: string
    href: string
    color?: string
}) {
    return (
        <a href={href}
            className="group block p-3 rounded-xl transition-all hover:brightness-105"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
            }}>
            <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-black text-app-foreground truncate">{title}</div>
                    <div className="text-[11px] font-medium text-app-muted-foreground line-clamp-2">{caption}</div>
                </div>
            </div>
        </a>
    )
}

/** Section container — bordered tinted surface for "Recent conversations", etc. */
export function SectionCard({
    title, icon, children, action,
}: {
    title: string
    icon?: ReactNode
    children: ReactNode
    action?: ReactNode
}) {
    return (
        <div className="rounded-2xl flex flex-col min-h-0"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
            }}>
            <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="flex items-center gap-1.5">
                    {icon && <div className="text-app-muted-foreground">{icon}</div>}
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                        {title}
                    </h3>
                </div>
                {action}
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar">
                {children}
            </div>
        </div>
    )
}

/** Standard empty state — conforms to §9. */
export function EmptyState({
    icon, title, description, action,
}: {
    icon: ReactNode
    title: string
    description?: string
    action?: ReactNode
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-app-muted-foreground mb-3 opacity-40">{icon}</div>
            <p className="text-sm font-bold text-app-muted-foreground">{title}</p>
            {description && (
                <p className="text-[11px] text-app-muted-foreground mt-1 max-w-md">{description}</p>
            )}
            {action && <div className="mt-3">{action}</div>}
        </div>
    )
}

/** Standard loading state — conforms to §10. */
export function Loading() {
    return (
        <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-app-primary" />
        </div>
    )
}

/** Inline status pill — small colored chip for badges like "Default", "Active", "Idle". */
export function StatusPill({
    label, color, icon,
}: {
    label: string
    color: string
    icon?: ReactNode
}) {
    return (
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}>
            {icon}
            {label}
        </span>
    )
}
