'use client'

import { useEffect, useState, useRef } from 'react'
import {
    Zap, Bell, Loader2, X, ExternalLink, Pencil, User, Users,
    UserCog, AlertCircle, Plus, Minus, ChevronRight, Check,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

const QUICK_DAYS = [3, 7, 14, 30]

type Routing = {
    Icon: typeof User
    label: string
    color: string
}

function routingFor(rule: any): Routing {
    if (rule.assign_to_user) {
        return { Icon: User, label: 'Goes to one person', color: 'var(--app-info, #3b82f6)' }
    }
    if (rule.assign_to_user_group) {
        return { Icon: Users, label: 'Goes to a team', color: 'var(--app-success, #22c55e)' }
    }
    if (rule.template?.assign_to_role) {
        return { Icon: UserCog, label: 'Routed automatically', color: 'var(--app-primary)' }
    }
    return { Icon: AlertCircle, label: 'No-one assigned yet', color: 'var(--app-warning, #f59e0b)' }
}

export function TaskSettingsModal({ onClose }: { onClose: () => void }) {
    const [days, setDays] = useState<number>(7)
    const [loadingSettings, setLoadingSettings] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)
    const [rules, setRules] = useState<any[]>([])
    const [loadingRules, setLoadingRules] = useState(true)
    const [togglingId, setTogglingId] = useState<number | null>(null)
    const dialogRef = useRef<HTMLDivElement | null>(null)

    // Esc to close + focus trap
    useEffect(() => {
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
            if (e.key === 'Tab' && dialogRef.current) {
                const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
                if (focusables.length === 0) return
                const first = focusables[0]
                const last = focusables[focusables.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus()
                }
            }
        }
        window.addEventListener('keydown', keyHandler)
        return () => window.removeEventListener('keydown', keyHandler)
    }, [onClose])

    useEffect(() => {
        erpFetch('settings/item/period_reminder_days_before/')
            .then((v: any) => {
                const n = Number(v)
                if (Number.isFinite(n) && n > 0) setDays(n)
            })
            .catch(() => {})
            .finally(() => setLoadingSettings(false))
    }, [])

    useEffect(() => {
        erpFetch('auto-task-rules/')
            .then((r: any) => {
                const all = Array.isArray(r) ? r : r?.results || []
                setRules(all.filter((x: any) => (x.module || '').toLowerCase() === 'finance'))
            })
            .catch(() => setRules([]))
            .finally(() => setLoadingRules(false))
    }, [])

    const saveLead = async (v: number) => {
        const clamped = Math.max(1, Math.min(60, Math.round(v)))
        if (clamped === days) return
        setDays(clamped)
        setSavingSettings(true)
        try {
            await erpFetch('settings/item/period_reminder_days_before/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clamped),
            })
            toast.success(`Lead-time set to ${clamped} day${clamped === 1 ? '' : 's'}`)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSavingSettings(false)
        }
    }

    const toggleRule = async (rule: any) => {
        setTogglingId(rule.id)
        try {
            await erpFetch(`auto-task-rules/${rule.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !rule.is_active }),
            })
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Toggle failed')
        } finally {
            setTogglingId(null)
        }
    }

    const activeRules = rules.filter(r => r.is_active).length

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                ref={dialogRef}
                role="dialog" aria-modal="true" aria-labelledby="task-settings-title"
                className="w-full sm:max-w-[560px] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0 duration-300 max-h-[92vh] sm:max-h-[85vh] flex flex-col"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
                }}
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div
                    className="px-4 sm:px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0"
                    style={{
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 14%, var(--app-surface)) 0%, var(--app-surface) 100%)',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 8px 20px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                            }}
                        >
                            <Zap size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 id="task-settings-title" style={{ color: 'var(--app-foreground)' }}>
                                Task Settings
                            </h3>
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                Finance · Reminders & Auto-tasks
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-app-border/40"
                        style={{ color: 'var(--app-muted-foreground)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body (scrolls) ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5">

                    {/* ── Reminder Lead-Time card ────────────────────── */}
                    <section
                        className="rounded-2xl p-4 sm:p-5"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 18%, transparent)',
                        }}
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 14%, transparent)',
                                    color: 'var(--app-primary)',
                                }}
                            >
                                <Bell size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--app-primary)' }}>
                                    Reminder lead-time
                                </div>
                                <p className="text-[12px] font-medium leading-relaxed mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                    How many days before a period's end or start the reminder fires.
                                </p>
                            </div>
                            {savingSettings && (
                                <Loader2 size={14} className="animate-spin flex-shrink-0 mt-1" style={{ color: 'var(--app-primary)' }} />
                            )}
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center gap-3 mb-3">
                            <button
                                onClick={() => saveLead(days - 1)}
                                disabled={loadingSettings || savingSettings || days <= 1}
                                aria-label="Decrease days"
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:bg-app-border/40"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                            >
                                <Minus size={14} />
                            </button>
                            <div
                                className="flex-1 flex items-baseline justify-center gap-2 py-2 rounded-xl tabular-nums"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                            >
                                <span className="text-[28px] font-black" style={{ color: 'var(--app-foreground)' }}>{days}</span>
                                <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {days === 1 ? 'day' : 'days'}
                                </span>
                            </div>
                            <button
                                onClick={() => saveLead(days + 1)}
                                disabled={loadingSettings || savingSettings || days >= 60}
                                aria-label="Increase days"
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:bg-app-border/40"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Quick-pick chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                Quick pick:
                            </span>
                            {QUICK_DAYS.map(d => {
                                const selected = d === days
                                return (
                                    <button
                                        key={d}
                                        onClick={() => saveLead(d)}
                                        disabled={loadingSettings || savingSettings}
                                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                                        style={{
                                            background: selected
                                                ? 'var(--app-primary)'
                                                : 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                            color: selected ? 'white' : 'var(--app-primary)',
                                            border: `1px solid ${selected ? 'var(--app-primary)' : 'transparent'}`,
                                        }}
                                    >
                                        {d}d
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    {/* ── Auto-task rules ───────────────────────────── */}
                    <section>
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Finance auto-task rules
                                </span>
                                {!loadingRules && (
                                    <span
                                        className="text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}
                                    >
                                        {activeRules}/{rules.length} active
                                    </span>
                                )}
                            </div>
                            <Link
                                href="/workspace/auto-task-rules?module=finance"
                                onClick={onClose}
                                className="flex items-center gap-1 text-[11px] font-bold transition-all hover:underline"
                                style={{ color: 'var(--app-primary)' }}
                            >
                                Open editor <ExternalLink size={10} />
                            </Link>
                        </div>

                        {loadingRules ? (
                            <div
                                className="flex items-center justify-center py-10 rounded-2xl"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                            >
                                <Loader2 size={18} className="animate-spin text-app-primary" />
                            </div>
                        ) : rules.length === 0 ? (
                            <div
                                className="p-6 text-center rounded-2xl text-[12px] font-medium"
                                style={{
                                    background: 'var(--app-bg)',
                                    border: '1px dashed var(--app-border)',
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                No finance rules yet.{' '}
                                <Link
                                    href="/workspace/auto-task-rules?module=finance"
                                    onClick={onClose}
                                    className="font-bold underline"
                                    style={{ color: 'var(--app-primary)' }}
                                >
                                    Create one
                                </Link>.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rules.map(r => {
                                    const routing = routingFor(r)
                                    const RoutingIcon = routing.Icon
                                    return (
                                        <div
                                            key={r.id}
                                            className="rounded-xl p-3 transition-all"
                                            style={{
                                                background: r.is_active
                                                    ? 'var(--app-bg)'
                                                    : 'color-mix(in srgb, var(--app-muted-foreground) 4%, transparent)',
                                                border: `1px solid ${
                                                    r.is_active
                                                        ? 'var(--app-border)'
                                                        : 'color-mix(in srgb, var(--app-border) 50%, transparent)'
                                                }`,
                                                opacity: r.is_active ? 1 : 0.6,
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Status dot */}
                                                <div className="pt-1.5 flex-shrink-0">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{
                                                            background: r.is_active
                                                                ? 'var(--app-success, #22c55e)'
                                                                : 'var(--app-muted-foreground)',
                                                            boxShadow: r.is_active
                                                                ? '0 0 0 3px color-mix(in srgb, var(--app-success, #22c55e) 25%, transparent)'
                                                                : 'none',
                                                        }}
                                                    />
                                                </div>

                                                {/* Body */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[12px] font-black truncate" style={{ color: 'var(--app-foreground)' }}>
                                                            {r.name}
                                                        </span>
                                                        {r.code && (
                                                            <span
                                                                className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                                                                style={{
                                                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                                                                    color: 'var(--app-muted-foreground)',
                                                                }}
                                                            >
                                                                {r.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <RoutingIcon size={10} style={{ color: routing.color, flexShrink: 0 }} />
                                                        <span className="text-[10px] font-bold" style={{ color: routing.color }}>
                                                            {routing.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Toggle + edit */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => toggleRule(r)}
                                                        disabled={togglingId === r.id}
                                                        title={r.is_active ? 'Disable rule' : 'Enable rule'}
                                                        aria-pressed={r.is_active}
                                                        className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                                                        style={{
                                                            background: r.is_active
                                                                ? 'var(--app-primary)'
                                                                : 'color-mix(in srgb, var(--app-muted-foreground) 25%, transparent)',
                                                            boxShadow: r.is_active
                                                                ? '0 2px 8px color-mix(in srgb, var(--app-primary) 35%, transparent)'
                                                                : 'none',
                                                        }}
                                                    >
                                                        <span
                                                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md"
                                                            style={{ left: r.is_active ? 'calc(100% - 22px)' : '2px' }}
                                                        />
                                                        {togglingId === r.id && (
                                                            <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />
                                                        )}
                                                    </button>
                                                    <Link
                                                        href="/workspace/auto-task-rules?module=finance"
                                                        onClick={onClose}
                                                        title="Edit in full editor"
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-app-border/40"
                                                        style={{ color: 'var(--app-muted-foreground)' }}
                                                    >
                                                        <Pencil size={12} />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── Helper note ───────────────────────────────── */}
                    <Link
                        href="/workspace/user-groups"
                        onClick={onClose}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:brightness-110"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 18%, transparent)',
                        }}
                    >
                        <Users size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--app-foreground)' }}>
                            Need ad-hoc teams? Manage them in <span className="font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>User Groups</span>.
                        </span>
                        <ChevronRight size={12} style={{ color: 'var(--app-info, #3b82f6)' }} />
                    </Link>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div
                    className="px-4 sm:px-5 py-3 flex items-center justify-end flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        borderTop: '1px solid var(--app-border)',
                    }}
                >
                    <button
                        onClick={onClose}
                        className="text-[12px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                    >
                        <Check size={14} /> Done
                    </button>
                </div>
            </div>
        </div>
    )
}
