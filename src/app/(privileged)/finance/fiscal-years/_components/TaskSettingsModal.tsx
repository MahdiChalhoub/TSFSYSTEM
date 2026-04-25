'use client'

import { useEffect, useState, useRef } from 'react'
import { Zap, Bell, Loader2, X, ExternalLink, Check, Pencil } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

export function TaskSettingsModal({ onClose }: { onClose: () => void }) {
    const [days, setDays] = useState<number>(7)
    const [loadingSettings, setLoadingSettings] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)
    const [rules, setRules] = useState<any[]>([])
    const [loadingRules, setLoadingRules] = useState(true)
    const [togglingId, setTogglingId] = useState<number | null>(null)
    const daysInputRef = useRef<HTMLInputElement | null>(null)
    const dialogRef = useRef<HTMLDivElement | null>(null)

    // Close on Esc, autofocus the first field, and trap focus within the dialog.
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
        setTimeout(() => daysInputRef.current?.focus(), 0)
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
        setSavingSettings(true)
        try {
            await erpFetch('settings/item/period_reminder_days_before/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(v),
            })
            toast.success(`Reminder lead-time set to ${v} day${v === 1 ? '' : 's'}`)
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="task-settings-title"
                className="w-full max-w-xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Zap size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 id="task-settings-title" className="text-sm font-bold text-app-foreground">Task Settings · Finance</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">Reminders · auto-task rules · routing</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close dialog"
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div className="rounded-xl p-4"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Bell size={13} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-primary)' }}>Reminder Lead-Time</span>
                        </div>
                        <p className="text-tp-sm font-medium mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                            How many days before a period's end/start the reminder task fires.
                        </p>
                        <div className="flex items-center gap-2">
                            <input ref={daysInputRef} type="number" min={1} max={60} value={days}
                                disabled={loadingSettings || savingSettings}
                                onChange={e => { const n = Math.max(1, Math.min(60, Number(e.target.value) || 1)); setDays(n) }}
                                onBlur={() => { if (!loadingSettings) saveLead(days) }}
                                aria-label="Reminder lead-time in days"
                                className="w-20 text-tp-lg font-bold tabular-nums px-2 py-1.5 rounded-lg outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <span className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>days</span>
                            {savingSettings && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--app-primary)' }} />}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                Finance auto-task rules · {rules.length}
                            </span>
                            <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                className="flex items-center gap-1 text-tp-xs font-bold transition-all"
                                style={{ color: 'var(--app-primary)' }}>
                                Open full editor <ExternalLink size={10} />
                            </Link>
                        </div>
                        <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            {loadingRules ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={18} className="animate-spin text-app-primary" />
                                </div>
                            ) : rules.length === 0 ? (
                                <div className="p-4 text-tp-sm text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No finance rules yet.{' '}
                                    <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                        className="font-bold underline" style={{ color: 'var(--app-primary)' }}>
                                        Create one
                                    </Link>.
                                </div>
                            ) : rules.map((r, i) => (
                                <div key={r.id}
                                    className={`flex items-center gap-2 px-3 py-2.5 transition-all ${i > 0 ? 'border-t border-app-border/30' : ''} ${!r.is_active ? 'opacity-60' : ''}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {r.code && (
                                                <span className="text-tp-xxs font-bold font-mono px-1.5 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {r.code}
                                                </span>
                                            )}
                                            <span className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{r.name}</span>
                                        </div>
                                        <div className="text-tp-xs font-medium truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {r.assign_to_user ? 'Goes to one person'
                                                : r.assign_to_user_group ? 'Goes to a team'
                                                : r.template?.assign_to_role ? 'Routed automatically'
                                                : 'No-one assigned yet'}
                                        </div>
                                    </div>
                                    <button onClick={() => toggleRule(r)} disabled={togglingId === r.id}
                                        title={r.is_active ? 'Disable' : 'Enable'}
                                        className={`w-9 h-4 rounded-full relative transition-all flex-shrink-0 ${r.is_active ? 'bg-app-primary' : 'bg-app-border'}`}>
                                        <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${r.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                    <Link href="/workspace/auto-task-rules?module=finance" onClick={onClose}
                                        title="Edit in full editor"
                                        className="p-1 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0">
                                        <Pencil size={12} />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl p-3 flex items-center gap-2"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                        <Check size={13} style={{ color: 'var(--app-info)' }} />
                        <span className="text-tp-xs font-medium" style={{ color: 'var(--app-foreground)' }}>
                            For ad-hoc teams, visit{' '}
                            <Link href="/workspace/user-groups" onClick={onClose} className="font-bold underline" style={{ color: 'var(--app-info)' }}>
                                User Groups
                            </Link>.
                        </span>
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-bg))', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose}
                        className="text-tp-sm font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
