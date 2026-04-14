'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
    Settings2, Shield, BookOpen, Target, Calendar,
    CheckCircle2, AlertCircle, Circle,
    ChevronRight, CreditCard, Hash, ShieldAlert,
    RefreshCw, Sprout, Trash2
} from 'lucide-react'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { updateGeneralSettings, type AccountingSetupStatus, type GeneralSettings } from '@/app/actions/finance/settings'
import { type Currency } from '@/app/actions/currencies'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ── Types ──

interface Props {
    setupStatus: AccountingSetupStatus
    currencies: Currency[]
}

// ── Step Card Config ──

const STEP_CONFIG: Record<string, {
    icon: typeof Shield
    color: string
    href: string
    description: string
}> = {
    tax_policy: {
        icon: Shield,
        color: '#8b5cf6',
        href: '/finance/tax-policy',
        description: 'Configure your organization\'s tax behavior — VAT, AIRSI, withholding, and periodic taxes.',
    },
    coa: {
        icon: BookOpen,
        color: 'var(--app-info, #3b82f6)',
        href: '/finance/chart-of-accounts',
        description: 'Import a standard template (IFRS, PCG, OHADA) or build your own chart of accounts.',
    },
    posting_rules: {
        icon: Target,
        color: 'var(--app-success, #22c55e)',
        href: '/finance/settings/posting-rules',
        description: 'Map financial operations (sales, purchases, inventory) to GL accounts for auto-posting.',
    },
    fiscal_year: {
        icon: Calendar,
        color: 'var(--app-warning, #f59e0b)',
        href: '/finance/fiscal-years',
        description: 'Create accounting periods and manage year-end closing cycles.',
    },
}

// ── Status Badge ──

function StatusBadge({ status }: { status: 'complete' | 'partial' | 'not_started' }) {
    if (status === 'complete') {
        return (
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1"
                style={{
                    background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                    color: 'var(--app-success, #22c55e)',
                    border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                    borderRadius: '10px',
                }}>
                <CheckCircle2 size={11} /> Configured
            </div>
        )
    }
    if (status === 'partial') {
        return (
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1"
                style={{
                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                    color: 'var(--app-warning, #f59e0b)',
                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                    borderRadius: '10px',
                }}>
                <AlertCircle size={11} /> Incomplete
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1"
            style={{
                background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                color: 'var(--app-muted-foreground)',
                border: '1px solid color-mix(in srgb, var(--app-muted-foreground) 15%, transparent)',
                borderRadius: '10px',
            }}>
            <Circle size={11} /> Not Started
        </div>
    )
}

// ── Setup Step Card ──

function SetupStepCard({ step, index }: { step: AccountingSetupStatus['steps'][0]; index: number }) {
    const router = useRouter()
    const config = STEP_CONFIG[step.id]
    if (!config) return null

    const Icon = config.icon
    const isComplete = step.status === 'complete'

    return (
        <div
            className="group rounded-2xl overflow-hidden transition-all cursor-pointer hover:brightness-[1.02] animate-in fade-in duration-200"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                animationDelay: `${index * 80}ms`,
                animationFillMode: 'both',
            }}
            onClick={() => router.push(config.href)}
        >
            {/* Card Header */}
            <div className="flex items-center gap-3 px-4 py-3.5"
                style={{
                    background: `color-mix(in srgb, ${config.color} 4%, var(--app-surface))`,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    borderLeft: `3px solid ${isComplete ? 'var(--app-success, #22c55e)' : config.color}`,
                }}>
                {/* Step Number */}
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                    style={{
                        background: isComplete
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                            : 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                        color: isComplete ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)',
                    }}>
                    {isComplete ? <CheckCircle2 size={13} /> : index + 1}
                </div>

                {/* Icon Box */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                        color: config.color,
                    }}>
                    <Icon size={18} />
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-app-foreground truncate">{step.label}</div>
                    <div className="text-[10px] font-bold text-app-muted-foreground truncate">{step.summary}</div>
                </div>

                {/* Status + Arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={step.status} />
                    <ChevronRight size={14} className="text-app-muted-foreground group-hover:text-app-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>

            {/* Card Body */}
            <div className="px-4 py-3">
                <p className="text-[11px] text-app-muted-foreground leading-relaxed">{config.description}</p>
                {step.detail && (
                    <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: config.color }} />
                        <span className="text-[10px] font-bold text-app-foreground">{step.detail}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Progress Bar ──

function ProgressBar({ completed, total }: { completed: number; total: number }) {
    const pct = total > 0 ? (completed / total) * 100 : 0
    const isAllDone = completed === total

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${pct}%`,
                        background: isAllDone
                            ? 'var(--app-success, #22c55e)'
                            : 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-success, #22c55e)))',
                    }}
                />
            </div>
            <span className="text-[11px] font-black text-app-foreground tabular-nums whitespace-nowrap">
                {completed}/{total}
            </span>
        </div>
    )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function AccountingSetupHub({ setupStatus, currencies }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isRecalcPending, startRecalc] = useTransition()
    const { register, handleSubmit } = useForm<GeneralSettings>({
        defaultValues: setupStatus.generalSettings,
    })

    const [pendingAction, setPendingAction] = useState<{
        type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'
    } | null>(null)

    const onSaveGeneral = (data: GeneralSettings) => {
        startTransition(async () => {
            const res = await updateGeneralSettings(data)
            if (res.success) {
                toast.success('Settings saved')
            } else {
                toast.error(res.error || 'Failed to save')
            }
        })
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto animate-in fade-in duration-300">

            {/* ── V2 Header ── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 fade-in-up">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }}
                    >
                        <Settings2 size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Finance Module
                        </p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            Accounting Setup
                        </h1>
                        <p className="text-sm text-app-muted-foreground mt-0.5">
                            Configure your organization&apos;s financial foundation in 4 steps.
                        </p>
                    </div>
                </div>
            </header>

            {/* ── Progress ── */}
            <div className="mb-6 p-4 rounded-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-app-muted-foreground">
                        Setup Progress
                    </span>
                    {setupStatus.completedCount === setupStatus.totalCount && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase"
                            style={{ color: 'var(--app-success, #22c55e)' }}>
                            <CheckCircle2 size={12} /> All Configured
                        </div>
                    )}
                </div>
                <ProgressBar completed={setupStatus.completedCount} total={setupStatus.totalCount} />
            </div>

            {/* ── 4 Setup Steps ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {setupStatus.steps.map((step, i) => (
                    <SetupStepCard key={step.id} step={step} index={i} />
                ))}
            </div>

            {/* ── General Settings ── */}
            <div className="rounded-2xl overflow-hidden mb-6"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                <div className="px-4 py-3 flex items-center gap-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        <Settings2 size={15} />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-bold text-app-foreground">General Settings</h2>
                        <p className="text-[10px] font-bold text-app-muted-foreground">Currency, tax rate, and payment configuration</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSaveGeneral)} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Currency */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                                Default Currency
                            </label>
                            <select
                                {...register('currency')}
                                className="w-full px-3 py-2 text-sm border rounded-xl bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/20 outline-none transition-all"
                                style={{ borderColor: 'var(--app-border)' }}
                            >
                                <option value="">Select currency...</option>
                                {currencies.map(c => (
                                    <option key={c.id} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>

                        {/* TVA Rate */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                                Standard TVA Rate
                            </label>
                            <input
                                {...register('defaultTaxRate', { valueAsNumber: true })}
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 text-sm border rounded-xl bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/20 outline-none transition-all"
                                style={{ borderColor: 'var(--app-border)' }}
                            />
                        </div>

                        {/* Save Button */}
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                style={{
                                    background: 'var(--app-primary)',
                                    color: 'white',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                }}
                            >
                                {isPending ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => router.push('/finance/settings/payment-methods')}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all hover:bg-app-surface"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                            <CreditCard size={12} /> Payment Methods
                        </button>
                        <button type="button" onClick={() => router.push('/settings/sequences')}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all hover:bg-app-surface"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                            <Hash size={12} /> Document Sequences
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Maintenance Zone ── */}
            <div className="rounded-2xl overflow-hidden"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)',
                }}>
                <div className="px-4 py-3 flex items-center gap-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, var(--app-surface))',
                        borderBottom: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                        borderLeft: '3px solid var(--app-error, #ef4444)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',
                            color: 'var(--app-error, #ef4444)',
                        }}>
                        <ShieldAlert size={15} />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>Maintenance Zone</h2>
                        <p className="text-[10px] font-bold text-app-muted-foreground">System administration and data management</p>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    {/* Recalculate */}
                    <div className="flex items-center justify-between p-3 rounded-xl"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)',
                        }}>
                        <div className="flex items-center gap-3">
                            <RefreshCw size={16} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <div>
                                <div className="text-[12px] font-bold text-app-foreground">Recalculate Ledger Balances</div>
                                <div className="text-[10px] text-app-muted-foreground">Rebuilds account balances from posted journal entries</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={isRecalcPending}
                            onClick={() => setPendingAction({
                                type: 'recalculate',
                                title: 'Recalculate Balances?',
                                description: 'This will reset and recalculate all account balances based on the ledger history.',
                                variant: 'warning',
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all hover:brightness-95"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                                color: 'var(--app-warning, #f59e0b)',
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                            }}
                        >
                            {isRecalcPending ? 'Processing...' : 'Recalculate'}
                        </button>
                    </div>

                    {/* Seed Data */}
                    <div className="flex items-center justify-between p-3 rounded-xl"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)',
                        }}>
                        <div className="flex items-center gap-3">
                            <Sprout size={16} style={{ color: 'var(--app-success, #22c55e)' }} />
                            <div>
                                <div className="text-[12px] font-bold text-app-foreground">Seed Test Data</div>
                                <div className="text-[10px] text-app-muted-foreground">Fill database with test products, suppliers, and stock</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPendingAction({
                                type: 'seedData',
                                title: 'Seed Test Data?',
                                description: 'This will populate the database with test products, suppliers, and initial stock.',
                                variant: 'warning',
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all hover:brightness-95"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)',
                                color: 'var(--app-success, #22c55e)',
                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                            }}
                        >
                            Seed Data
                        </button>
                    </div>

                    {/* Fresh Version */}
                    <div className="flex items-center justify-between p-3 rounded-xl"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 5%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)',
                        }}>
                        <div className="flex items-center gap-3">
                            <Trash2 size={16} style={{ color: 'var(--app-error, #ef4444)' }} />
                            <div>
                                <div className="text-[12px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>Fresh Version (Wipe All Data)</div>
                                <div className="text-[10px] text-app-muted-foreground">DELETES all products, orders, ledger, CRM, and inventory</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPendingAction({
                                type: 'wipeAll',
                                title: 'CRITICAL: Fresh Version',
                                description: 'This will delete EVERYTHING (Products, Orders, Ledger, Contacts). This cannot be undone.',
                                variant: 'danger',
                            })}
                            className="text-[11px] font-black px-3 py-1.5 rounded-xl border transition-all hover:brightness-95"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 40%, transparent)',
                                color: 'white',
                                background: 'var(--app-error, #ef4444)',
                            }}
                        >
                            FRESH VERSION
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Confirm Dialog ── */}
            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open) setPendingAction(null) }}
                onConfirm={() => {
                    if (!pendingAction) return
                    if (pendingAction.type === 'recalculate') {
                        startRecalc(async () => {
                            try {
                                const res = await recalculateAccountBalances()
                                toast(res.success ? 'Balances recalculated successfully.' : 'Recalculation failed.', {
                                    icon: res.success ? '✅' : '❌'
                                })
                            } catch (e: unknown) {
                                toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    } else if (pendingAction.type === 'wipeAll') {
                        startTransition(async () => {
                            try {
                                const { wipeAllOperationalData } = await import('@/app/actions/finance/system')
                                await wipeAllOperationalData()
                                toast.success("System wiped to Fresh Version.")
                                router.refresh()
                            } catch (e: unknown) {
                                toast.error("Error: " + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    } else if (pendingAction.type === 'seedData') {
                        startTransition(async () => {
                            try {
                                const { seedTestData } = await import('@/app/actions/finance/system')
                                await seedTestData()
                                toast.success("Test data seeded successfully!")
                                router.refresh()
                            } catch (e: unknown) {
                                toast.error("Error: " + (e instanceof Error ? e.message : String(e)))
                            }
                        })
                    }
                    setPendingAction(null)
                }}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={pendingAction?.variant ?? 'danger'}
            />
        </div>
    )
}
