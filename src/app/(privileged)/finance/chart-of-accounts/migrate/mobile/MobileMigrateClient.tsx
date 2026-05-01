'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileMigrateClient — mobile-native COA migration flow.
 *  3 stages:
 *    1. Review current state + pick target template
 *    2. Analyze preview (scrollable bottom-sheet with grouped accounts)
 *    3. Apply migration
 * ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useMemo } from 'react'
import {
    ArrowRightLeft, Database, Zap, Loader2, CheckCircle2, AlertTriangle,
    DollarSign, FileText, UserPlus, ChevronRight, ArrowRight, RefreshCw,
    BookOpen, BarChart3,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    getMigrationPreview,
    importChartOfAccountsTemplate,
} from '@/app/actions/finance/coa-templates'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-coa-migrate-mobile'

interface Props {
    templateList: { key: string; name: string }[]
    currentTemplateKey: string
    accountCount: number
    journalEntryCount: number
    hasData: boolean
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<React.ComponentProps<'svg'> & { size?: number | string }>; hint: string }> = {
    HAS_BALANCE: { label: 'With balance', color: 'var(--app-warning, #f59e0b)', icon: DollarSign, hint: 'Non-zero balance; mapping preserves it' },
    HAS_TRANSACTIONS: { label: 'With transactions', color: 'var(--app-info, #3b82f6)', icon: FileText, hint: 'Has journal entries; mapping will remap them' },
    CUSTOM: { label: 'Custom accounts', color: 'var(--app-info)', icon: UserPlus, hint: 'Not in target template — you choose where to map' },
    CLEAN: { label: 'Clean', color: 'var(--app-success, #10b981)', icon: CheckCircle2, hint: 'No balance, no transactions — safe to replace' },
}

export function MobileMigrateClient({
    templateList,
    currentTemplateKey,
    accountCount,
    journalEntryCount,
    hasData,
}: Props) {
    const router = useRouter()
    const [targetKey, setTargetKey] = useState('')
    const [preview, setPreview] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const targetName = useMemo(() => {
        if (!targetKey) return ''
        return templateList.find(t => t.key === targetKey)?.name || targetKey
    }, [targetKey, templateList])

    const currentName = useMemo(
        () => currentTemplateKey ? currentTemplateKey.replace(/_/g, ' ') : 'No template',
        [currentTemplateKey]
    )

    const handleAnalyze = useCallback(async () => {
        if (!targetKey) return
        setLoading(true)
        try {
            const data = await getMigrationPreview(targetKey)
            if (data) {
                setPreview(data)
                setPreviewOpen(true)
                toast.success(`${data.summary.total_accounts} accounts analyzed`)
            } else {
                toast.error('Failed to load migration preview')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Error loading preview')
        } finally {
            setLoading(false)
        }
    }, [targetKey])

    const handleExecute = useCallback(async () => {
        if (!targetKey || !preview) return
        setExecuting(true)
        try {
            const accountMapping: Record<string, string> = {}
            for (const acc of preview.accounts) {
                if (acc.category === 'CLEAN' && !acc.is_custom) continue
                const targetCode = acc.suggested_target?.code || ''
                if (targetCode && targetCode !== acc.code) {
                    accountMapping[acc.code] = targetCode
                }
            }
            const result = await importChartOfAccountsTemplate(targetKey, {
                reset: true,
                account_mapping: accountMapping,
            })
            toast.success(`Migrated to ${targetName}`)
            router.push('/finance/chart-of-accounts')
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Migration failed')
        } finally {
            setExecuting(false)
            setConfirmOpen(false)
            setPreviewOpen(false)
        }
    }, [targetKey, preview, router, targetName])

    const pickerItems = useMemo(() => {
        return templateList
            .filter(t => t.key !== currentTemplateKey)
            .map(t => ({
                key: t.key,
                label: t.name,
                hint: t.key,
                icon: <BookOpen size={16} />,
                onClick: () => { setTargetKey(t.key); setPreview(null) },
            }))
    }, [templateList, currentTemplateKey])

    return (
        <MobileMasterPage
            config={{
                title: 'Migration Tool',
                subtitle: hasData
                    ? `${accountCount} accounts · ${journalEntryCount} journal entries`
                    : 'Switch chart-of-accounts template',
                icon: <ArrowRightLeft size={20} />,
                iconColor: 'var(--app-warning, #f59e0b)',
                tourId: 'finance-coa-migrate-mobile',
                searchPlaceholder: 'Not searchable',
                primaryAction: {
                    label: 'Back',
                    icon: <BookOpen size={16} />,
                    onClick: () => router.push('/finance/chart-of-accounts'),
                },
                secondaryActions: [
                    { label: 'Templates Library', icon: <BookOpen size={14} />, href: '/finance/chart-of-accounts/templates' },
                    { label: 'Back to COA', icon: <BookOpen size={14} />, href: '/finance/chart-of-accounts' },
                ],
                kpis: [
                    { label: 'Current', value: currentName, icon: <Database size={13} />, color: 'var(--app-primary)' },
                    { label: 'Accounts', value: accountCount, icon: <BarChart3 size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Journal Entries', value: journalEntryCount, icon: <FileText size={13} />, color: 'var(--app-warning, #f59e0b)' },
                ],
                footerLeft: hasData ? (
                    <>
                        <span style={{ color: 'var(--app-warning, #f59e0b)' }}>Migration required</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{accountCount} accounts to migrate</span>
                    </>
                ) : <span>No migration data</span>,
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        title="Select target template"
                        subtitle={`${pickerItems.length} available`}
                        items={pickerItems}
                    />
                    <ConfirmDialog
                        open={confirmOpen}
                        onOpenChange={(o) => { if (!o) setConfirmOpen(false) }}
                        onConfirm={handleExecute}
                        title={`Migrate to ${targetName}?`}
                        description={`This will replace the current chart of accounts and remap ${journalEntryCount} journal entries. Cannot be undone.`}
                        confirmText="Migrate"
                        variant="warning"
                    />
                    <PageTour tourId="finance-coa-migrate-mobile" renderButton={false} />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    initialSnap="expanded">
                    {preview && (
                        <PreviewSheet
                            preview={preview}
                            targetName={targetName}
                            executing={executing}
                            onApply={() => setConfirmOpen(true)}
                            onClose={() => setPreviewOpen(false)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {() => (
                <div className="space-y-3">
                    {/* Current template card */}
                    <div className="rounded-2xl p-4"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Database size={14} style={{ color: 'var(--app-primary)' }} />
                            <span className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                Current Template
                            </span>
                        </div>
                        <div className="font-bold text-app-foreground" style={{ fontSize: 'var(--tp-2xl)' }}>
                            {currentName}
                        </div>
                        {hasData && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="flex items-center gap-1 font-bold rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                                        color: 'var(--app-info, #3b82f6)',
                                    }}>
                                    <BarChart3 size={11} /> {accountCount} accounts
                                </span>
                                {journalEntryCount > 0 && (
                                    <span className="flex items-center gap-1 font-bold rounded-lg px-2 py-1"
                                        style={{
                                            fontSize: 'var(--tp-xs)',
                                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                            color: 'var(--app-warning, #f59e0b)',
                                        }}>
                                        <FileText size={11} /> {journalEntryCount} journal entries
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Target picker */}
                    <button
                        onClick={() => setPickerOpen(true)}
                        className="w-full text-left rounded-2xl p-4 active:scale-[0.99] transition-transform"
                        style={{
                            background: targetKey
                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-surface))'
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: targetKey
                                ? '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)'
                                : '1px dashed color-mix(in srgb, var(--app-border) 55%, transparent)',
                        }}>
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowRight size={14} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <span className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                Target Template
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-app-foreground truncate" style={{ fontSize: 'var(--tp-2xl)' }}>
                                {targetKey ? targetName : 'Tap to pick target'}
                            </div>
                            <ChevronRight size={18} className="text-app-muted-foreground flex-shrink-0" />
                        </div>
                        {targetKey && (
                            <div className="font-mono font-bold text-app-muted-foreground mt-0.5"
                                style={{ fontSize: 'var(--tp-xs)' }}>
                                {targetKey}
                            </div>
                        )}
                    </button>

                    {/* Analyze button */}
                    <button
                        onClick={handleAnalyze}
                        disabled={!targetKey || loading}
                        className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-bold active:scale-[0.98] transition-transform"
                        style={{
                            fontSize: 'var(--tp-lg)',
                            minHeight: 52,
                            color: targetKey ? '#fff' : 'var(--app-muted-foreground)',
                            background: targetKey
                                ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-accent)))'
                                : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            boxShadow: targetKey
                                ? '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                : 'none',
                            opacity: (!targetKey || loading) ? 0.6 : 1,
                            cursor: (!targetKey || loading) ? 'not-allowed' : 'pointer',
                        }}>
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
                        ) : (
                            <><BarChart3 size={16} /> Analyze Migration</>
                        )}
                    </button>

                    {/* Results hint */}
                    {preview && (
                        <button
                            onClick={() => setPreviewOpen(true)}
                            className="w-full rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
                            style={{
                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                            }}>
                            <CheckCircle2 size={20} style={{ color: 'var(--app-info, #3b82f6)', flexShrink: 0 }} />
                            <div className="flex-1 min-w-0 text-left">
                                <div className="font-bold text-app-foreground" style={{ fontSize: 'var(--tp-lg)' }}>
                                    Preview ready — {preview.summary.total_accounts} accounts
                                </div>
                                <div className="text-app-muted-foreground" style={{ fontSize: 'var(--tp-xs)' }}>
                                    Tap to review and apply
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-app-muted-foreground flex-shrink-0" />
                        </button>
                    )}

                    {/* Empty / pre-analyze hint */}
                    {!preview && !loading && (
                        <div className="rounded-2xl py-10 px-4 text-center"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                border: '1px dashed color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="inline-flex items-center justify-center rounded-full mb-3"
                                style={{
                                    width: 56, height: 56,
                                    background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                    color: 'var(--app-primary)',
                                }}>
                                <ArrowRightLeft size={24} />
                            </div>
                            <p className="font-bold text-app-foreground mb-1" style={{ fontSize: 'var(--tp-lg)' }}>
                                Select a target template
                            </p>
                            <p className="text-app-muted-foreground max-w-xs mx-auto"
                                style={{ fontSize: 'var(--tp-md)' }}>
                                The system will scan all accounts and show what needs attention before migration.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </MobileMasterPage>
    )
}

/* ─── Preview sheet ─── */
function PreviewSheet({ preview, targetName, executing, onApply, onClose }: any) {
    const summary = preview.summary || {}
    const accounts = preview.accounts || []
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        HAS_BALANCE: true,
        HAS_TRANSACTIONS: true,
        CUSTOM: true,
    })

    const grouped = useMemo(() => {
        const groups: Record<string, any[]> = { HAS_BALANCE: [], HAS_TRANSACTIONS: [], CUSTOM: [], CLEAN: [] }
        for (const acc of accounts) {
            const key = groups[acc.category] !== undefined ? acc.category : 'CLEAN'
            groups[key].push(acc)
        }
        return groups
    }, [accounts])

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-accent)))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        color: '#fff',
                    }}>
                    <BarChart3 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-2xl)' }}>
                        Migration Preview
                    </h3>
                    <div className="font-bold text-app-muted-foreground truncate" style={{ fontSize: 'var(--tp-sm)' }}>
                        → {targetName}
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {[
                        { key: 'total_accounts', label: 'Total', color: 'var(--app-primary)' },
                        { key: 'clean_count', label: 'Clean', color: 'var(--app-success, #10b981)' },
                        { key: 'has_balance_count', label: 'With Balance', color: 'var(--app-warning, #f59e0b)' },
                        { key: 'has_transactions_count', label: 'With Transactions', color: 'var(--app-info, #3b82f6)' },
                        { key: 'custom_count', label: 'Custom', color: 'var(--app-info)' },
                    ].map(s => (
                        <div key={s.key} className="rounded-2xl px-3 py-3"
                            style={{
                                background: `color-mix(in srgb, ${s.color} 6%, var(--app-surface))`,
                                border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
                            }}>
                            <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                {s.label}
                            </div>
                            <div className="font-bold tabular-nums" style={{ fontSize: 'var(--tp-stat)', color: s.color }}>
                                {summary[s.key] ?? 0}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grouped account lists */}
                {(['HAS_BALANCE', 'HAS_TRANSACTIONS', 'CUSTOM', 'CLEAN'] as const).map(cat => {
                    const cfg = CATEGORY_CONFIG[cat]
                    const items = grouped[cat] || []
                    if (items.length === 0) return null
                    const isOpen = expanded[cat]
                    const CatIcon = cfg.icon
                    return (
                        <div key={cat} className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                border: `1px solid color-mix(in srgb, ${cfg.color} 22%, transparent)`,
                            }}>
                            <button
                                onClick={() => setExpanded(p => ({ ...p, [cat]: !p[cat] }))}
                                className="w-full flex items-center gap-2 px-3 py-2.5 active:bg-app-primary/5 transition-colors"
                                style={{ borderBottom: isOpen && items.length > 0 ? `1px solid color-mix(in srgb, ${cfg.color} 15%, transparent)` : 'none' }}>
                                <CatIcon size={14} style={{ color: cfg.color, flexShrink: 0 }} />
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-bold text-app-foreground truncate" style={{ fontSize: 'var(--tp-md)' }}>
                                        {cfg.label}
                                    </div>
                                    <div className="font-medium text-app-muted-foreground truncate" style={{ fontSize: 'var(--tp-xxs)' }}>
                                        {cfg.hint}
                                    </div>
                                </div>
                                <span className="font-bold tabular-nums rounded-full px-2 py-0.5 flex-shrink-0"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
                                        color: cfg.color,
                                        minWidth: 24, textAlign: 'center',
                                    }}>
                                    {items.length}
                                </span>
                                <ChevronRight size={14}
                                    style={{
                                        color: 'var(--app-muted-foreground)', flexShrink: 0,
                                        transition: 'transform 150ms',
                                        transform: isOpen ? 'rotate(90deg)' : 'none',
                                    }} />
                            </button>
                            {isOpen && (
                                <div className="animate-in fade-in duration-150">
                                    {items.slice(0, 50).map((acc: any, i: number) => {
                                        const hasTarget = acc.suggested_target?.code && acc.suggested_target.code !== acc.code
                                        const targetName = acc.suggested_target?.name
                                        return (
                                            <div key={`${acc.code}-${i}`}
                                                className="px-3 py-2"
                                                style={{
                                                    borderTop: i === 0 ? undefined : '1px dashed color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                }}>
                                                {/* Source: code · name */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold tabular-nums flex-shrink-0"
                                                        style={{ fontSize: 'var(--tp-sm)', color: cfg.color, minWidth: 46 }}>
                                                        {acc.code}
                                                    </span>
                                                    <span className="font-bold text-app-foreground truncate flex-1"
                                                        style={{ fontSize: 'var(--tp-sm)' }}>
                                                        {acc.name}
                                                    </span>
                                                </div>
                                                {/* Target: code · name (indented under source) */}
                                                {hasTarget && (
                                                    <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: 46 + 8 }}>
                                                        <ArrowRight size={11} style={{ color: 'var(--app-muted-foreground)', flexShrink: 0 }} />
                                                        <span className="font-mono font-bold tabular-nums flex-shrink-0"
                                                            style={{ fontSize: 'var(--tp-xs)', color: 'var(--app-muted-foreground)', minWidth: 42 }}>
                                                            {acc.suggested_target.code}
                                                        </span>
                                                        <span className="font-bold truncate flex-1"
                                                            style={{ fontSize: 'var(--tp-xs)', color: 'var(--app-muted-foreground)' }}>
                                                            {targetName || '—'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {items.length > 50 && (
                                        <div className="px-3 py-2 text-center font-bold text-app-muted-foreground"
                                            style={{
                                                fontSize: 'var(--tp-xxs)',
                                                borderTop: '1px dashed color-mix(in srgb, var(--app-border) 20%, transparent)',
                                            }}>
                                            + {items.length - 50} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                <button onClick={onClose}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46, padding: '0 16px',
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}>
                    Cancel
                </button>
                <button
                    onClick={onApply}
                    disabled={executing}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46,
                        color: '#fff',
                        background: 'var(--app-warning, #f59e0b)',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--app-warning, #f59e0b) 35%, transparent)',
                        opacity: executing ? 0.6 : 1,
                    }}>
                    {executing ? (
                        <><Loader2 size={14} className="animate-spin" /> Migrating…</>
                    ) : (
                        <><Zap size={14} /> Apply Migration</>
                    )}
                </button>
            </div>
        </div>
    )
}
