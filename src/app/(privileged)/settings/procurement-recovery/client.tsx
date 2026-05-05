'use client'

/**
 * Procurement Recovery Policy — admin UI.
 *
 * Configures how long each terminal state (Received / Cancelled /
 * Rejected / Failed) stays before the chip auto-recycles to "Available".
 * REJECTED gets a per-reason override table so different rejection
 * reasons can recover at different speeds (e.g. NO_STOCK in 3 days,
 * DAMAGED never).
 *
 * Persistence: server-side via the generic settings/item/<key>/ endpoint
 * (key = procurement_recovery_policy). Stored on Organization.settings,
 * so the policy is tenant-wide — every user in the org sees and edits
 * the same values regardless of device.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
    Save, RotateCcw, Info, CheckCircle, Ban, XCircle, AlertTriangle, Clock, Loader2,
} from 'lucide-react'
import {
    DEFAULT_RECOVERY_POLICY,
    type PipelineRecoveryPolicy,
    type RecoveryRule,
} from '@/lib/procurement-status'
import {
    getRecoveryPolicy,
    saveRecoveryPolicy,
    resetRecoveryPolicy,
} from '@/app/actions/settings/procurement-recovery'
import { invalidateRecoveryPolicyCache } from '@/hooks/useProcurementRecoveryPolicy'

type TerminalKey = keyof PipelineRecoveryPolicy

const TERMINAL_META: Record<TerminalKey, {
    label: string
    description: string
    icon: typeof CheckCircle
    color: string
    bg: string
}> = {
    RECEIVED: {
        label: 'Received',
        description: 'Goods landed — cycle complete. Default 0 days = the chip flips to Available immediately so the next request can start.',
        icon: CheckCircle,
        color: 'var(--app-success, #22c55e)',
        bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
    },
    CANCELLED: {
        label: 'Cancelled',
        description: 'Operator pulled the request back. Brief grace period to see the "Cancelled" stamp, then the row leaves active filters.',
        icon: Ban,
        color: 'var(--app-muted-foreground)',
        bg: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
    },
    REJECTED: {
        label: 'Rejected',
        description: 'Supplier (or approver) said no. Rejections often need human follow-up — set the cooldown longer, with per-reason overrides below.',
        icon: XCircle,
        color: 'var(--app-error, #ef4444)',
        bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
    },
    FAILED: {
        label: 'Failed',
        description: 'System / data integrity failure. Default = never auto-recover so a human reviews each case.',
        icon: AlertTriangle,
        color: 'var(--app-error, #ef4444)',
        bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
    },
}

const REJECTION_REASONS: Array<{ key: string; label: string; hint: string }> = [
    { key: 'NO_STOCK',       label: 'No Stock',         hint: 'Supplier ran out — try again soon when restocked' },
    { key: 'PRICE_HIGH',     label: 'Price Too High',   hint: 'Renegotiation or alternate supplier needed' },
    { key: 'EXPIRY_TOO_SOON', label: 'Expiry Too Soon', hint: 'Date issue — re-issue might find better-dated stock' },
    { key: 'DAMAGED',        label: 'Damaged Goods',    hint: 'Manual decision (write-off / claim)' },
    { key: 'NEEDS_REVISION', label: 'Needs Revision',   hint: 'Operator rebuilds the request quickly' },
    { key: 'OTHER',          label: 'Other',            hint: 'Generic catch-all' },
]

export default function ProcurementRecoveryClient() {
    const [policy, setPolicy] = useState<PipelineRecoveryPolicy>(DEFAULT_RECOVERY_POLICY)
    const [dirty, setDirty] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const [saving, startSaving] = useTransition()

    useEffect(() => {
        // Server-side load — reads Organization.settings.procurement_recovery_policy
        // so every user in the tenant sees the same values regardless of
        // which device or browser they're on.
        getRecoveryPolicy().then(p => {
            setPolicy(p)
            setHydrated(true)
        })
    }, [])

    const updateRule = (key: TerminalKey, patch: Partial<RecoveryRule>) => {
        setPolicy(p => ({ ...p, [key]: { ...p[key], ...patch } }))
        setDirty(true)
    }
    const updateReasonDays = (reasonKey: string, days: number | null) => {
        setPolicy(p => ({
            ...p,
            REJECTED: {
                ...p.REJECTED,
                perReasonDays: { ...(p.REJECTED.perReasonDays || {}), [reasonKey]: days },
            },
        }))
        setDirty(true)
    }
    const handleSave = () => {
        startSaving(async () => {
            const r = await saveRecoveryPolicy(policy)
            if (r.ok) {
                // Bust the in-memory cache so chip renderers across the
                // app pick up the new policy without a full page reload.
                invalidateRecoveryPolicyCache(policy)
                toast.success('Recovery policy saved · applies to all users in your organization')
                setDirty(false)
            } else toast.error(`Could not save: ${r.error}`)
        })
    }
    const handleReset = () => {
        if (!confirm('Reset all recovery rules to defaults? This affects every user in the organization.')) return
        startSaving(async () => {
            const r = await resetRecoveryPolicy()
            if (r.ok) {
                invalidateRecoveryPolicyCache(DEFAULT_RECOVERY_POLICY)
                setPolicy(DEFAULT_RECOVERY_POLICY)
                setDirty(false)
                toast.success('Reverted to defaults')
            } else {
                toast.error(`Could not reset: ${r.error}`)
            }
        })
    }

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {/* ── Page Header ── */}
            <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3">
                <div className="flex items-center justify-between gap-4 mb-1">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Clock size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-tp-lg">
                                Procurement Recovery
                            </h1>
                            <p className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide">
                                When a chip leaves a terminal state and goes back to Available
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleReset} disabled={saving}
                            className="flex items-center gap-1 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 h-9 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50">
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button onClick={handleSave} disabled={!dirty || saving}
                            className="flex items-center gap-1 text-tp-xs font-bold text-white px-4 h-9 rounded-xl transition-all disabled:opacity-50 active:scale-95"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: dirty ? '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'none',
                            }}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
                        </button>
                    </div>
                </div>

                {/* Explainer banner */}
                <div className="mt-3 p-3 rounded-xl flex items-start gap-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                    }}>
                    <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info, #3b82f6)' }} />
                    <div className="text-tp-xs text-app-foreground">
                        Set how many days a row stays in each terminal state before the chip auto-recycles to <strong>Available</strong>.
                        Use <strong>0</strong> for "immediately", leave <strong>blank / empty</strong> for "never (manual review only)".
                        Per-reason overrides on Rejected let different rejection causes recover at different speeds.
                    </div>
                </div>
            </div>

            {/* ── Cards ── */}
            <div className="flex-1 px-4 md:px-6 pb-6 grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                {(Object.keys(TERMINAL_META) as TerminalKey[]).map(key => (
                    <RuleCard
                        key={key}
                        terminalKey={key}
                        rule={policy[key]}
                        onChange={patch => updateRule(key, patch)}
                        onChangeReasonDays={key === 'REJECTED' ? updateReasonDays : undefined}
                        hydrated={hydrated}
                    />
                ))}
            </div>
        </div>
    )
}

/** A single card per terminal state. Top-level day input + (REJECTED only)
 *  the per-reason override table. */
function RuleCard({ terminalKey, rule, onChange, onChangeReasonDays, hydrated }: {
    terminalKey: TerminalKey
    rule: RecoveryRule
    onChange: (patch: Partial<RecoveryRule>) => void
    onChangeReasonDays?: (reasonKey: string, days: number | null) => void
    hydrated: boolean
}) {
    const meta = TERMINAL_META[terminalKey]
    const Icon = meta.icon
    const days = rule.autoRecoverAfterDays
    const isNever = days === null

    return (
        <div className="rounded-2xl p-4"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-tp-md font-bold text-app-foreground">{meta.label}</div>
                    <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                        Terminal stage
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="text-tp-xs text-app-muted-foreground mb-3 leading-relaxed">{meta.description}</p>

            {/* Days input */}
            <DaysInput
                value={days}
                onChange={v => onChange({ autoRecoverAfterDays: v })}
                disabled={!hydrated}
                color={meta.color}
            />

            {/* Per-reason overrides — REJECTED only */}
            {terminalKey === 'REJECTED' && onChangeReasonDays && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    <div className="text-tp-xxs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                        Per-reason overrides
                    </div>
                    <p className="text-tp-xxs text-app-muted-foreground mb-3 leading-relaxed">
                        Each reason can recover faster, slower, or never. Reasons not listed use the top-level cooldown above.
                    </p>
                    <div className="flex flex-col gap-2">
                        {REJECTION_REASONS.map(r => {
                            const overrideDays = rule.perReasonDays?.[r.key]
                            const hasOverride = overrideDays !== undefined
                            return (
                                <div key={r.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                    style={{ background: 'color-mix(in srgb, var(--app-bg, #020617) 60%, transparent)' }}>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-tp-sm font-bold text-app-foreground truncate">{r.label}</div>
                                        <div className="text-tp-xxs text-app-muted-foreground truncate">{r.hint}</div>
                                    </div>
                                    <DaysInput
                                        compact
                                        value={hasOverride ? overrideDays : days}
                                        onChange={v => onChangeReasonDays(r.key, v)}
                                        disabled={!hydrated}
                                        color={meta.color}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

/** Days input — number field + a "Never" toggle. null = never recover. */
function DaysInput({ value, onChange, disabled, color, compact }: {
    value: number | null
    onChange: (v: number | null) => void
    disabled?: boolean
    color: string
    compact?: boolean
}) {
    const isNever = value === null
    return (
        <div className={`flex items-center gap-2 ${compact ? '' : 'mt-1'}`}>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={isNever ? '' : value}
                    onChange={e => {
                        const v = e.target.value
                        if (v === '') onChange(null)
                        else onChange(Math.max(0, Number(v)))
                    }}
                    disabled={disabled || isNever}
                    placeholder="—"
                    className={`text-tp-md font-bold text-app-foreground rounded-lg outline-none text-center transition-all ${compact ? 'w-14 h-7' : 'w-20 h-9'}`}
                    style={{
                        background: 'var(--app-bg, #020617)',
                        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                    }}
                />
                <span className="text-tp-xs font-bold text-app-muted-foreground">days</span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={isNever}
                    onChange={e => onChange(e.target.checked ? null : 7)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded accent-app-warning"
                />
                <span className="text-tp-xs font-bold text-app-muted-foreground">Never</span>
            </label>
        </div>
    )
}
