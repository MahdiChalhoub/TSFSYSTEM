'use client'

/* ═══════════════════════════════════════════════════════════
 *  FINANCE REPORT PRIMITIVES (v2)
 *  - Print-proper: every viewer wraps its body in
 *    `<div className="report-print-root">` and globals.css @media
 *    print rules strip chrome, paginate tables, set A4 margins,
 *    swap the statement header into place.
 *  - Table semantics: ReportPanel no longer has a `footer` slot;
 *    totals go inside the body's own `<tfoot>` so column widths
 *    stay aligned and print pagination works.
 *  - StatementHeader: centered Company / Report / Period block
 *    that screens muted but prints prominent — matches the
 *    accounting-statement convention.
 *  - CSV export + serif title — the two missing pro touches.
 * ═══════════════════════════════════════════════════════════ */

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, ChevronRight, ChevronDown, Calendar, Printer,
    RefreshCw, AlertCircle, CheckCircle2, Download,
} from 'lucide-react'

/* ─── App-side page header (stays hidden in print) ─── */
export function ReportHeader({
    backHref = '/finance/reports',
    title, subtitle, icon, iconColor, trailing,
}: {
    backHref?: string
    title: string
    subtitle: string
    icon: ReactNode
    iconColor: string
    trailing?: ReactNode
}) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 report-only-screen print:hidden">
            <div className="flex items-center gap-3">
                <Link href={backHref}
                    className="p-2 rounded-xl transition-all"
                    style={{
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}
                    aria-label="Back">
                    <ArrowLeft size={16} />
                </Link>
                <div className="page-header-icon"
                    style={{
                        background: iconColor,
                        boxShadow: `0 4px 14px color-mix(in srgb, ${iconColor} 30%, transparent)`,
                    }}>
                    <span className="text-white [&>svg]:w-[20px] [&>svg]:h-[20px]">{icon}</span>
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold tracking-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        {title}
                    </h1>
                    <p className="text-tp-xs md:text-tp-sm font-bold uppercase tracking-wide"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {subtitle}
                    </p>
                </div>
            </div>
            {trailing && <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">{trailing}</div>}
        </div>
    )
}

/* ─── Statement header — centred Company · Report · Period block.
 *     Muted-but-visible on screen, promoted on print. ─── */
export function StatementHeader({
    organizationName, reportName, period,
}: {
    organizationName?: string
    reportName: string
    period: string
}) {
    return (
        <div className="text-center py-2 print:pt-0 print:pb-6 print:mb-4"
            style={{
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
            }}>
            {organizationName && (
                <p className="text-tp-xs font-bold uppercase tracking-[0.25em]"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {organizationName}
                </p>
            )}
            <h2 className="report-statement-title text-xl md:text-2xl print:text-3xl font-bold tracking-tight mt-1"
                style={{ color: 'var(--app-foreground)' }}>
                {reportName}
            </h2>
            <p className="text-tp-sm print:text-base font-medium mt-0.5"
                style={{ color: 'var(--app-muted-foreground)' }}>
                {period}
            </p>
        </div>
    )
}

/* ─── Controls strip ─── */
export function ReportControls({
    children,
    onRefresh,
    refreshing,
    onPrint,
    onExport,
    refreshLabel = 'Generate',
}: {
    children: ReactNode
    onRefresh: () => void
    refreshing?: boolean
    onPrint?: () => void
    onExport?: () => void
    refreshLabel?: string
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3 p-3 rounded-2xl print:hidden"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="flex flex-wrap items-end gap-3">
                {children}
                <button onClick={onRefresh} disabled={refreshing}
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                    style={{
                        background: 'var(--app-primary)', color: 'white',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        height: '38px',
                    }}>
                    <RefreshCw size={13}
                        style={{ animation: refreshing ? 'spin 0.9s linear infinite' : undefined }} />
                    {refreshing ? 'Updating…' : refreshLabel}
                </button>
            </div>
            <div className="flex gap-2">
                {onExport && (
                    <button onClick={onExport}
                        className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-2 rounded-xl border transition-all"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            borderColor: 'var(--app-border)',
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            height: '38px',
                        }}>
                        <Download size={13} />
                        <span className="hidden md:inline">Export CSV</span>
                    </button>
                )}
                {onPrint && (
                    <button onClick={onPrint}
                        className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-2 rounded-xl border transition-all"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            borderColor: 'var(--app-border)',
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            height: '38px',
                        }}>
                        <Printer size={13} />
                        <span className="hidden md:inline">Print PDF</span>
                    </button>
                )}
            </div>
        </div>
    )
}

/* ─── Period-preset chips (works for single-date or range) ─── */
type Preset =
    | 'today' | 'this_month' | 'last_month'
    | 'this_quarter' | 'last_quarter'
    | 'ytd' | 'last_year'

export function PeriodPresets({ mode, onPick }: {
    mode: 'single' | 'range'
    onPick: (p: { start?: string; end: string }) => void
}) {
    const iso = (d: Date) => d.toISOString().split('T')[0]
    const now = new Date()
    const presets: { key: Preset; label: string; resolve: () => { start?: string; end: string } }[] = [
        { key: 'today', label: 'Today', resolve: () => ({ start: iso(now), end: iso(now) }) },
        { key: 'this_month', label: 'This month', resolve: () => {
            const s = new Date(now.getFullYear(), now.getMonth(), 1)
            const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            return { start: iso(s), end: iso(e) }
        }},
        { key: 'last_month', label: 'Last month', resolve: () => {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const e = new Date(now.getFullYear(), now.getMonth(), 0)
            return { start: iso(s), end: iso(e) }
        }},
        { key: 'this_quarter', label: 'QTD', resolve: () => {
            const q = Math.floor(now.getMonth() / 3)
            const s = new Date(now.getFullYear(), q * 3, 1)
            return { start: iso(s), end: iso(now) }
        }},
        { key: 'ytd', label: 'YTD', resolve: () => {
            const s = new Date(now.getFullYear(), 0, 1)
            return { start: iso(s), end: iso(now) }
        }},
        { key: 'last_year', label: 'Last year', resolve: () => {
            const s = new Date(now.getFullYear() - 1, 0, 1)
            const e = new Date(now.getFullYear() - 1, 11, 31)
            return { start: iso(s), end: iso(e) }
        }},
    ]
    const items = mode === 'single'
        ? presets.filter(p => ['today', 'this_month', 'last_month', 'ytd'].includes(p.key))
        : presets

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map(p => (
                <button key={p.key} onClick={() => onPick(p.resolve())}
                    type="button"
                    className="text-tp-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all hover:scale-[1.03]"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        color: 'var(--app-primary)',
                    }}>
                    {p.label}
                </button>
            ))}
        </div>
    )
}

export function DateField({ label, value, onChange }: {
    label: string; value: string; onChange: (v: string) => void
}) {
    return (
        <div className="space-y-1">
            <label className="text-tp-xxs font-bold uppercase tracking-wide flex items-center gap-1"
                style={{ color: 'var(--app-muted-foreground)' }}>
                <Calendar size={11} /> {label}
            </label>
            <input type="date" value={value} onChange={e => onChange(e.target.value)}
                className="rounded-xl px-3 text-tp-sm font-medium outline-none transition-all"
                style={{
                    background: 'var(--app-background)',
                    border: '1px solid var(--app-border)',
                    color: 'var(--app-foreground)',
                    height: '38px',
                }} />
        </div>
    )
}

export function StatusBanner({
    ok, okTitle, okMessage, failTitle, failMessage, action,
}: {
    ok: boolean
    okTitle: string; okMessage: string
    failTitle: string; failMessage: string
    action?: ReactNode
}) {
    const color = ok ? 'var(--app-success)' : 'var(--app-error)'
    const Icon = ok ? CheckCircle2 : AlertCircle
    return (
        <div className="p-3 rounded-2xl flex items-center justify-between gap-3 report-only-screen print:hidden"
            style={{
                background: `color-mix(in srgb, ${color} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    <Icon size={15} />
                </div>
                <div>
                    <p className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                        {ok ? okTitle : failTitle}
                    </p>
                    <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {ok ? okMessage : failMessage}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {action}
                <div className="text-right">
                    <div className="text-tp-xxs font-bold uppercase tracking-wide"
                        style={{ color: 'var(--app-muted-foreground)' }}>Status</div>
                    <div className="font-mono font-bold text-tp-sm" style={{ color }}>
                        {ok ? 'HEALTHY' : 'CRITICAL'}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function MetricTile({ label, value, secondary, icon, color, tone = 'soft' }: {
    label: string; value: string; secondary?: string
    icon?: ReactNode; color: string; tone?: 'soft' | 'solid'
}) {
    if (tone === 'solid') {
        return (
            <div className="p-4 rounded-2xl flex flex-col justify-center gap-0.5"
                style={{
                    background: color, color: 'white',
                    boxShadow: `0 6px 18px color-mix(in srgb, ${color} 30%, transparent)`,
                }}>
                <p className="text-tp-xxs font-bold uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-2xl font-mono font-bold tabular-nums">{value}</p>
                {secondary && <p className="text-tp-xs opacity-70 font-medium">{secondary}</p>}
            </div>
        )
    }
    return (
        <div className="p-3 rounded-2xl flex items-center justify-between gap-3"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="min-w-0">
                <p className="text-tp-xxs font-bold uppercase tracking-wide mb-1"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {label}
                </p>
                <p className="text-tp-xl font-mono font-bold tabular-nums"
                    style={{ color: 'var(--app-foreground)' }}>
                    {value}
                </p>
                {secondary && (
                    <p className="text-tp-xs font-medium mt-0.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {secondary}
                    </p>
                )}
            </div>
            {icon && (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {icon}
                </div>
            )}
        </div>
    )
}

/* ─── Report panel — pure frame, no footer slot (totals go in <tfoot>) ─── */
export function ReportPanel({
    title, icon, accent, children,
}: {
    title?: string; icon?: ReactNode; accent?: string; children: ReactNode
}) {
    return (
        <div className="rounded-2xl overflow-hidden print:rounded-none print:border-0"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            {title && (
                <div className="px-4 py-3 flex items-center gap-2 print:py-2"
                    style={{
                        background: accent
                            ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))`
                            : 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                        borderBottom: `1px solid color-mix(in srgb, ${accent || 'var(--app-border)'} 25%, var(--app-border))`,
                        color: accent || 'var(--app-foreground)',
                    }}>
                    {icon && (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                                background: `color-mix(in srgb, ${accent || 'var(--app-primary)'} 15%, transparent)`,
                                color: accent || 'var(--app-primary)',
                            }}>
                            {icon}
                        </div>
                    )}
                    <h2 className="text-tp-md font-bold uppercase tracking-wide">{title}</h2>
                </div>
            )}
            <div>{children}</div>
        </div>
    )
}

/* ─── Section header row ─── */
export function SectionRow({ title, accent, colSpan = 2 }: {
    title: string; accent: string; colSpan?: number
}) {
    return (
        <tr style={{ background: `color-mix(in srgb, ${accent} 6%, transparent)` }}>
            <td colSpan={colSpan}
                className="px-4 py-2 text-tp-xxs font-bold uppercase tracking-wide"
                style={{ color: accent, borderLeft: `3px solid ${accent}` }}>
                {title}
            </td>
        </tr>
    )
}

/* ─── Subtotal row inside a section (tone='soft') or top-level
 *     statement total (tone='bold') ─── */
export function TotalRow({
    label, amount, accent, tone = 'soft', formatAmount, colSpan = 1, extra,
}: {
    label: string
    amount: number
    accent?: string
    tone?: 'soft' | 'bold' | 'result'
    formatAmount: (v: number) => string
    /** Columns that precede the amount column. Most reports: 1 (account name).
     *  Trial Balance with debit/credit: 2 (name spans until debit). */
    colSpan?: number
    /** Extra trailing cells (e.g. comparison / margin columns) */
    extra?: ReactNode
}) {
    if (tone === 'bold') {
        return (
            <tr style={{
                background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                borderTop: `2px solid color-mix(in srgb, ${accent || 'var(--app-primary)'} 40%, var(--app-border))`,
            }}>
                <td colSpan={colSpan} className="px-4 py-3 text-right text-tp-xxs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {label}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-tp-xl tabular-nums"
                    style={{ color: accent || 'var(--app-foreground)' }}>
                    {formatAmount(amount)}
                </td>
                {extra}
            </tr>
        )
    }
    if (tone === 'result') {
        return (
            <tr style={{
                background: `color-mix(in srgb, ${accent || 'var(--app-primary)'} 10%, transparent)`,
                borderTop: `3px double color-mix(in srgb, ${accent || 'var(--app-primary)'} 50%, var(--app-border))`,
            }}>
                <td colSpan={colSpan} className="px-4 py-4 text-right text-tp-xxs font-bold uppercase tracking-[0.25em]"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    {label}
                </td>
                <td className="px-4 py-4 text-right font-mono font-bold text-2xl tabular-nums"
                    style={{ color: accent || 'var(--app-foreground)' }}>
                    {formatAmount(amount)}
                </td>
                {extra}
            </tr>
        )
    }
    return (
        <tr style={{
            background: accent
                ? `color-mix(in srgb, ${accent} 4%, transparent)`
                : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
        }}>
            <td colSpan={colSpan} className="px-4 py-2 text-right text-tp-xxs font-bold uppercase tracking-wide"
                style={{ color: 'var(--app-muted-foreground)' }}>
                {label}
            </td>
            <td className="px-4 py-2 text-right font-mono font-bold text-tp-md tabular-nums"
                style={{ color: accent || 'var(--app-foreground)' }}>
                {formatAmount(amount)}
            </td>
            {extra}
        </tr>
    )
}

/* ─── Recursive chart-of-accounts row ─── */
export function AccountRow({
    account, allAccounts, formatAmount, level = 0, columns = 'amount', accent,
    priorMap, issueIds,
}: {
    account: any
    allAccounts: any[]
    formatAmount: (v: number) => string
    level?: number
    columns?: 'amount' | 'debit-credit' | 'amount-compare'
    accent?: string
    /** Prior-period balances keyed by account id, for 'amount-compare' column set */
    priorMap?: Record<number, number>
    /** Set of account IDs to highlight as discrepancy source (inline diagnostics) */
    issueIds?: Set<number>
}) {
    const [expanded, setExpanded] = useState(level < 1)
    const isParent = account.children && account.children.length > 0
    const hasBalance = Math.abs(account.balance ?? 0) > 0.001
    if (!hasBalance && !isParent) return null

    const indent = level * 18 + 12
    const isIssue = issueIds?.has(account.id)
    const rowBg = isIssue
        ? 'color-mix(in srgb, var(--app-error) 6%, transparent)'
        : isParent
            ? 'color-mix(in srgb, var(--app-surface) 40%, transparent)'
            : 'transparent'
    const rowBorder = isIssue
        ? '1px solid color-mix(in srgb, var(--app-error) 30%, transparent)'
        : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)'

    const curr = account.balance ?? 0
    const prior = priorMap?.[account.id] ?? 0
    const variance = curr - prior
    const variancePct = prior !== 0 ? (variance / Math.abs(prior)) * 100 : null

    return (
        <>
            <tr className="group transition-colors"
                style={{ background: rowBg, borderBottom: rowBorder }}>
                {columns === 'debit-credit' && (
                    <td className="px-3 py-1.5 font-mono text-tp-xxs"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {account.code}
                    </td>
                )}
                <td className="px-3 py-1.5" style={{ paddingLeft: `${indent}px` }}>
                    <div className="flex items-center gap-2">
                        {isParent ? (
                            <button onClick={() => setExpanded(!expanded)}
                                aria-label={expanded ? 'Collapse' : 'Expand'}
                                className="w-4 h-4 flex items-center justify-center rounded hover:bg-app-border/40 transition-colors"
                                style={{ color: expanded ? (accent || 'var(--app-primary)') : 'var(--app-muted-foreground)' }}>
                                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                        ) : (
                            <span className="w-4 flex items-center justify-center">
                                <span className="w-1 h-1 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                            </span>
                        )}
                        {columns !== 'debit-credit' && (
                            <span className="font-mono text-tp-xxs opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {account.code}
                            </span>
                        )}
                        <span className={`text-tp-sm ${isParent ? 'font-bold' : 'font-medium'}`}
                            style={{ color: isParent ? (accent || 'var(--app-foreground)') : 'var(--app-foreground)' }}>
                            {account.name}
                        </span>
                        {isIssue && (
                            <span className="ml-1 text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full print:hidden"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error) 12%, transparent)',
                                    color: 'var(--app-error)',
                                }}>
                                suspect
                            </span>
                        )}
                    </div>
                </td>
                {columns === 'amount' && (
                    <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums text-tp-sm"
                        style={{ color: isParent ? (accent || 'var(--app-foreground)') : 'var(--app-foreground)' }}>
                        {formatAmount(curr)}
                    </td>
                )}
                {columns === 'amount-compare' && (
                    <>
                        <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums text-tp-sm"
                            style={{ color: isParent ? (accent || 'var(--app-foreground)') : 'var(--app-foreground)' }}>
                            {formatAmount(curr)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-tp-sm"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            {formatAmount(prior)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-tp-xs"
                            style={{
                                color: variance === 0
                                    ? 'var(--app-muted-foreground)'
                                    : variance > 0 ? 'var(--app-success)' : 'var(--app-error)',
                            }}>
                            {variance > 0 ? '+' : ''}{variancePct != null ? `${variancePct.toFixed(1)}%` : '—'}
                        </td>
                    </>
                )}
                {columns === 'debit-credit' && (
                    <>
                        <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums text-tp-sm"
                            style={{ color: 'var(--app-foreground)' }}>
                            {curr > 0 ? formatAmount(curr) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums text-tp-sm"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            {curr < 0 ? formatAmount(Math.abs(curr)) : '—'}
                        </td>
                    </>
                )}
            </tr>
            {isParent && expanded && account.children.map((childRef: any) => {
                const child = typeof childRef === 'object' ? childRef : allAccounts.find(a => a.id === childRef)
                if (!child) return null
                return (
                    <AccountRow key={child.id} account={child} allAccounts={allAccounts}
                        formatAmount={formatAmount} level={level + 1}
                        columns={columns} accent={accent}
                        priorMap={priorMap} issueIds={issueIds} />
                )
            })}
        </>
    )
}

/* ─── Table head ─── */
export function ReportTableHead({ columns = 'amount', labels }: {
    columns?: 'amount' | 'debit-credit' | 'amount-compare'
    labels?: {
        code?: string; name?: string; amount?: string
        debit?: string; credit?: string
        current?: string; prior?: string; variance?: string
    }
}) {
    const L = {
        code: 'Code', name: 'Account', amount: 'Amount',
        debit: 'Debit', credit: 'Credit',
        current: 'Current', prior: 'Prior', variance: 'Δ %',
        ...labels,
    }
    return (
        <thead>
            <tr className="text-tp-xxs font-bold uppercase tracking-wide"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    color: 'var(--app-muted-foreground)',
                    borderBottom: '2px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                }}>
                {columns === 'debit-credit' && <th scope="col" className="px-3 py-2 text-left w-24">{L.code}</th>}
                <th scope="col" className="px-3 py-2 text-left">{L.name}</th>
                {columns === 'amount' && <th scope="col" className="px-3 py-2 text-right w-40">{L.amount}</th>}
                {columns === 'amount-compare' && (
                    <>
                        <th scope="col" className="px-3 py-2 text-right w-32">{L.current}</th>
                        <th scope="col" className="px-3 py-2 text-right w-32">{L.prior}</th>
                        <th scope="col" className="px-3 py-2 text-right w-20">{L.variance}</th>
                    </>
                )}
                {columns === 'debit-credit' && (
                    <>
                        <th scope="col" className="px-3 py-2 text-right w-36">{L.debit}</th>
                        <th scope="col" className="px-3 py-2 text-right w-36">{L.credit}</th>
                    </>
                )}
            </tr>
        </thead>
    )
}

/* ─── Footnote ─── */
export function ReportFootnote({ mounted }: { mounted: boolean }) {
    return (
        <div className="text-center py-6 text-tp-xxs font-bold uppercase tracking-[0.25em] opacity-40 print:mt-8 print:opacity-60"
            style={{ color: 'var(--app-muted-foreground)' }}>
            TSF Financial Engine · Integrity Confirmed{mounted ? ` · ${new Date().toLocaleString()}` : ''}
        </div>
    )
}

/* ─── SSR-safe money formatter ─── */
export function useMoneyFormatter(mounted: boolean) {
    return (val: number | null) => {
        if (val == null) return '—'
        if (!mounted) return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
}

/* ─── CSV export helper ─── */
type CSVColumn<T> = {
    header: string
    get: (row: T) => string | number | null | undefined
}
export function exportCSV<T>({
    filename, columns, rows,
}: {
    filename: string
    columns: CSVColumn<T>[]
    rows: T[]
}) {
    const escape = (v: any) => {
        if (v == null) return ''
        const s = String(v)
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`
        }
        return s
    }
    const header = columns.map(c => escape(c.header)).join(',')
    const body = rows.map(r => columns.map(c => escape(c.get(r))).join(',')).join('\n')
    const csv = '﻿' + header + '\n' + body  // BOM so Excel picks up UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/* ─── Walk an account tree → flat rows (used by CSV export) ─── */
export function flattenAccounts(
    roots: any[],
    allAccounts: any[],
    depth = 0,
): Array<{ code: string; name: string; balance: number; depth: number; isParent: boolean }> {
    const out: any[] = []
    for (const acc of roots) {
        const isParent = acc.children && acc.children.length > 0
        out.push({
            code: acc.code ?? '',
            name: '  '.repeat(depth) + (acc.name ?? ''),
            balance: acc.balance ?? 0,
            depth, isParent,
        })
        if (isParent) {
            const children = acc.children.map((c: any) =>
                typeof c === 'object' ? c : allAccounts.find(a => a.id === c)
            ).filter(Boolean)
            out.push(...flattenAccounts(children, allAccounts, depth + 1))
        }
    }
    return out
}
