// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobilePostingRulesClient — mobile-native console for mapping
 *  ERP events to GL accounts. Replaces the dense desktop grid with
 *  a card-per-event list, module picker chip rail, and a bottom-sheet
 *  account tree picker.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    Target, Zap, Save, ShoppingCart, CreditCard, Package, Users, BarChart3,
    Wallet, Shield, Settings2, Landmark, ArrowRightLeft, RefreshCcw, Search,
    CheckCircle2, XCircle, Loader2, ChevronRight, Filter, ListChecks, Eye, EyeOff,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    autoDetectAndApply, bulkSaveRules,
    type PostingRuleV2, type CatalogModule,
} from '@/app/actions/finance/posting-rules'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-posting-rules-mobile'

const MODULE_META: Record<string, { icon: any; color: string; label: string }> = {
    sales:       { icon: ShoppingCart,   color: 'var(--app-info, #3b82f6)',    label: 'Sales' },
    purchases:   { icon: CreditCard,     color: '#8b5cf6',                     label: 'Purchases' },
    inventory:   { icon: Package,        color: 'var(--app-warning, #f59e0b)', label: 'Inventory' },
    payments:    { icon: Wallet,         color: 'var(--app-success, #22c55e)', label: 'Payments' },
    tax:         { icon: Shield,         color: 'var(--app-error, #ef4444)',   label: 'Tax' },
    treasury:    { icon: Landmark,       color: '#06b6d4',                     label: 'Treasury' },
    assets:      { icon: BarChart3,      color: '#64748b',                     label: 'Assets' },
    equity:      { icon: Users,          color: '#8b5cf6',                     label: 'Equity' },
    adjustment:  { icon: RefreshCcw,     color: '#f97316',                     label: 'Adjustments' },
    automation:  { icon: Zap,            color: 'var(--app-success, #22c55e)', label: 'Automation' },
    suspense:    { icon: ArrowRightLeft, color: 'var(--app-warning, #f59e0b)', label: 'Suspense' },
    partners:    { icon: Users,          color: '#8b5cf6',                     label: 'Partners' },
    fixedAssets: { icon: BarChart3,      color: '#64748b',                     label: 'Fixed Assets' },
    payroll:     { icon: Users,          color: '#ec4899',                     label: 'Payroll' },
}
const getMeta = (mod: string) => MODULE_META[mod] || { icon: Settings2, color: 'var(--app-muted-foreground)', label: mod }

const CRITICALITY_COLOR: Record<string, string> = {
    CRITICAL: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    NORMAL: 'var(--app-muted-foreground)',
    LOW: 'var(--app-muted-foreground)',
}

interface Props {
    rulesByModule: Record<string, PostingRuleV2[]>
    catalog: { modules: CatalogModule[]; total_events: number }
    accounts: Record<string, any>[]
}

export function MobilePostingRulesClient({ rulesByModule, catalog, accounts }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [selectedModule, setSelectedModule] = useState<string | null>(null)
    const [overrides, setOverrides] = useState<Record<string, number | null>>({})
    const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
    const [pickerForEvent, setPickerForEvent] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const { allRules, modules } = useMemo(() => {
        const ruleMap: Record<string, PostingRuleV2> = {}
        for (const rules of Object.values(rulesByModule))
            for (const r of rules) ruleMap[r.event_code] = r

        const rows: {
            event_code: string; label: string; description: string; module: string
            criticality: string; account: number | null; account_code: string
            account_name: string; is_mapped: boolean
        }[] = []

        for (const mod of catalog.modules) {
            for (const ev of mod.events) {
                const rule = ruleMap[ev.code]
                rows.push({
                    event_code: ev.code,
                    label: ev.label,
                    description: ev.description || '',
                    module: mod.key,
                    criticality: ev.criticality || 'NORMAL',
                    account: rule?.account ?? null,
                    account_code: rule?.account_code ?? '',
                    account_name: rule?.account_name ?? '',
                    is_mapped: !!rule?.account,
                })
            }
        }

        const grouped: Record<string, typeof rows> = {}
        for (const r of rows) (grouped[r.module] ||= []).push(r)
        return { allRules: rows, modules: grouped }
    }, [rulesByModule, catalog])

    const effectiveAccountId = (eventCode: string, base: number | null) => {
        return eventCode in overrides ? overrides[eventCode] : base
    }

    const effectiveRule = (r: any) => {
        const overrideId = overrides[r.event_code]
        if (overrideId === undefined) return { accountId: r.account, code: r.account_code, name: r.account_name, mapped: r.is_mapped }
        if (overrideId === null) return { accountId: null, code: '', name: '', mapped: false }
        const acc = accounts.find(a => a.id === overrideId)
        return {
            accountId: overrideId,
            code: acc?.code || '',
            name: acc?.name || '',
            mapped: true,
        }
    }

    const totalEvents = allRules.length
    const mappedEvents = allRules.filter(r => effectiveRule(r).mapped).length
    const unmappedEvents = totalEvents - mappedEvents
    const coveragePct = totalEvents > 0 ? Math.round((mappedEvents / totalEvents) * 100) : 0

    const moduleKeys = Object.keys(modules).sort((a, b) => a.localeCompare(b))
    const activeModule = selectedModule && moduleKeys.includes(selectedModule) ? selectedModule : moduleKeys[0] || null
    const activeRules = useMemo(() => {
        if (!activeModule) return []
        let rules = modules[activeModule] || []
        if (filter === 'mapped') rules = rules.filter(r => effectiveRule(r).mapped)
        if (filter === 'unmapped') rules = rules.filter(r => !effectiveRule(r).mapped)
        return rules
    }, [activeModule, modules, filter, overrides, accounts])

    const hasChanges = Object.keys(overrides).length > 0

    const openPicker = useCallback((eventCode: string) => setPickerForEvent(eventCode), [])
    const closePicker = useCallback(() => setPickerForEvent(null), [])

    const pickAccount = useCallback((accountId: number | null) => {
        if (!pickerForEvent) return
        setOverrides(prev => ({ ...prev, [pickerForEvent]: accountId }))
        closePicker()
    }, [pickerForEvent, closePicker])

    const handleSave = useCallback(async () => {
        const entries = Object.entries(overrides).filter(([, id]) => id != null) as [string, number][]
        if (entries.length === 0) { toast.info('No changes to save'); return }
        setSaving(true)
        try {
            const result = await bulkSaveRules(entries.map(([event_code, account_id]) => ({ event_code, account_id })))
            if (result.errors?.length) {
                toast.error(`Saved with errors: ${result.errors[0]}`)
            } else {
                toast.success(`Saved ${result.created + result.updated} rule${(result.created + result.updated) === 1 ? '' : 's'}`)
                setOverrides({})
                router.refresh()
            }
        } catch (e: any) {
            toast.error(e?.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }, [overrides, router])

    const handleAutoDetect = useCallback(() => {
        startTransition(async () => {
            try {
                const result = await autoDetectAndApply(70)
                toast.success(result.message || `Auto-mapped ${result.applied} events`)
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || 'Auto-detect failed')
            }
        })
    }, [router])

    const pickerRule = pickerForEvent ? allRules.find(r => r.event_code === pickerForEvent) : null
    const pickerCurrentId = pickerRule ? effectiveRule(pickerRule).accountId : null

    return (
        <MobileMasterPage
            config={{
                title: 'Posting Rules',
                subtitle: hasChanges
                    ? `${Object.keys(overrides).length} unsaved change${Object.keys(overrides).length === 1 ? '' : 's'}`
                    : `${coveragePct}% coverage · ${mappedEvents}/${totalEvents} mapped`,
                icon: <Target size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'finance-posting-rules-mobile',
                searchPlaceholder: 'Not searchable here',
                primaryAction: {
                    label: hasChanges ? 'Save Changes' : 'All Saved',
                    icon: saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2.6} />,
                    onClick: handleSave,
                },
                secondaryActions: [
                    { label: 'Auto-detect', icon: <Zap size={14} />, onClick: handleAutoDetect },
                    { label: 'Back to COA', icon: <BarChart3 size={14} />, href: '/finance/chart-of-accounts' },
                ],
                kpis: [
                    { label: 'Total Events', value: totalEvents, icon: <ListChecks size={13} />, color: 'var(--app-primary)' },
                    { label: 'Mapped', value: mappedEvents, icon: <CheckCircle2 size={13} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'Unmapped', value: unmappedEvents, icon: <XCircle size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Coverage', value: `${coveragePct}%`, icon: <Target size={13} />, color: 'var(--app-info, #3b82f6)' },
                ],
                footerLeft: (
                    <>
                        <span>{moduleKeys.length} modules</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{totalEvents} events</span>
                        {hasChanges && (
                            <>
                                <span style={{ color: 'var(--app-border)' }}>·</span>
                                <span style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                    {Object.keys(overrides).length} unsaved
                                </span>
                            </>
                        )}
                    </>
                ),
            }}
            modals={<PageTour tourId="finance-posting-rules-mobile" renderButton={false} />}
            sheet={
                <MobileBottomSheet
                    open={pickerForEvent !== null}
                    onClose={closePicker}
                    initialSnap="expanded">
                    {pickerRule && (
                        <AccountPickerSheet
                            event={pickerRule}
                            accounts={accounts}
                            currentAccountId={pickerCurrentId}
                            onPick={pickAccount}
                            onClear={() => pickAccount(null)}
                            onClose={closePicker}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {() => (
                <div className="space-y-3">
                    {/* Module chip rail */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                        {moduleKeys.map(mod => {
                            const meta = getMeta(mod)
                            const MIcon = meta.icon
                            const isActive = activeModule === mod
                            const rules = modules[mod] || []
                            const modUnmapped = rules.filter(r => !effectiveRule(r).mapped).length
                            return (
                                <button
                                    key={mod}
                                    onClick={() => setSelectedModule(mod)}
                                    className="flex-shrink-0 flex items-center gap-1.5 font-black rounded-xl px-3 py-2 active:scale-95 transition-all"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        minHeight: 38,
                                        color: isActive ? '#fff' : meta.color,
                                        background: isActive
                                            ? meta.color
                                            : `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                                        border: `1px solid color-mix(in srgb, ${meta.color} ${isActive ? 50 : 25}%, transparent)`,
                                        boxShadow: isActive ? `0 2px 8px color-mix(in srgb, ${meta.color} 30%, transparent)` : 'none',
                                    }}>
                                    <MIcon size={13} />
                                    <span>{meta.label}</span>
                                    {modUnmapped > 0 && (
                                        <span className="font-black tabular-nums rounded-full px-1.5 py-0.5"
                                            style={{
                                                fontSize: 'var(--tp-xxs)',
                                                minWidth: 18,
                                                textAlign: 'center',
                                                background: isActive ? 'rgba(255,255,255,0.2)' : `color-mix(in srgb, ${meta.color} 20%, transparent)`,
                                                color: isActive ? '#fff' : meta.color,
                                            }}>
                                            {modUnmapped}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Filter chips */}
                    <div className="flex items-center gap-1.5">
                        {(['all', 'mapped', 'unmapped'] as const).map(f => (
                            <button key={f}
                                onClick={() => setFilter(f)}
                                className="flex-1 font-black uppercase tracking-widest rounded-lg px-3 py-1.5 active:scale-95 transition-transform"
                                style={{
                                    fontSize: 'var(--tp-xxs)',
                                    minHeight: 32,
                                    background: filter === f
                                        ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)'
                                        : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    color: filter === f ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                    border: `1px solid ${filter === f ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                }}>
                                {f === 'all' ? `All (${modules[activeModule || '']?.length ?? 0})` :
                                 f === 'mapped' ? `Mapped (${(modules[activeModule || ''] || []).filter(r => effectiveRule(r).mapped).length})` :
                                                  `Unmapped (${(modules[activeModule || ''] || []).filter(r => !effectiveRule(r).mapped).length})`}
                            </button>
                        ))}
                    </div>

                    {/* Event cards */}
                    {activeRules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Target size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-md)' }}>
                                {filter === 'all' ? 'No events for this module' : `No ${filter} events here`}
                            </p>
                        </div>
                    ) : (
                        activeRules.map(r => {
                            const er = effectiveRule(r)
                            const isDirty = r.event_code in overrides
                            const critColor = CRITICALITY_COLOR[r.criticality] || CRITICALITY_COLOR.NORMAL
                            const moduleMeta = getMeta(r.module)
                            return (
                                <div key={r.event_code}
                                    className="rounded-2xl p-3"
                                    style={{
                                        background: isDirty
                                            ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, var(--app-surface))'
                                            : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                        border: `1px solid ${isDirty
                                            ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)'
                                            : 'color-mix(in srgb, var(--app-border) 45%, transparent)'}`,
                                        contentVisibility: 'auto',
                                        containIntrinsicSize: '0 140px',
                                    }}>
                                    {/* Event header */}
                                    <div className="flex items-start gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                <span className="font-mono font-black"
                                                    style={{ fontSize: 'var(--tp-xs)', color: moduleMeta.color }}>
                                                    {r.event_code}
                                                </span>
                                                {r.criticality && r.criticality !== 'NORMAL' && (
                                                    <span className="font-black uppercase tracking-widest rounded-full px-1.5 py-0.5"
                                                        style={{
                                                            fontSize: 'var(--tp-xxs)',
                                                            color: critColor,
                                                            background: `color-mix(in srgb, ${critColor} 12%, transparent)`,
                                                        }}>
                                                        {r.criticality}
                                                    </span>
                                                )}
                                                {isDirty && (
                                                    <span className="font-black uppercase tracking-widest rounded-full px-1.5 py-0.5"
                                                        style={{
                                                            fontSize: 'var(--tp-xxs)',
                                                            color: 'var(--app-warning, #f59e0b)',
                                                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                                                        }}>
                                                        UNSAVED
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-black text-app-foreground truncate"
                                                style={{ fontSize: 'var(--tp-lg)' }}>
                                                {r.label}
                                            </div>
                                            {r.description && (
                                                <p className="text-app-muted-foreground line-clamp-2 mt-0.5"
                                                    style={{ fontSize: 'var(--tp-xs)' }}>
                                                    {r.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Account mapping button */}
                                    <button
                                        onClick={() => openPicker(r.event_code)}
                                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-all text-left"
                                        style={{
                                            minHeight: 48,
                                            background: er.mapped
                                                ? 'color-mix(in srgb, var(--app-success, #22c55e) 7%, var(--app-surface))'
                                                : 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-surface))',
                                            border: `1px solid ${er.mapped
                                                ? 'color-mix(in srgb, var(--app-success, #22c55e) 25%, transparent)'
                                                : 'color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)'}`,
                                        }}>
                                        {er.mapped ? (
                                            <>
                                                <CheckCircle2 size={14} style={{ color: 'var(--app-success, #22c55e)', flexShrink: 0 }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-mono font-black tabular-nums truncate"
                                                        style={{ fontSize: 'var(--tp-md)', color: 'var(--app-success, #22c55e)' }}>
                                                        {er.code}
                                                    </div>
                                                    <div className="font-bold text-app-foreground truncate"
                                                        style={{ fontSize: 'var(--tp-xs)' }}>
                                                        {er.name}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={14} style={{ color: 'var(--app-warning, #f59e0b)', flexShrink: 0 }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black"
                                                        style={{ fontSize: 'var(--tp-md)', color: 'var(--app-warning, #f59e0b)' }}>
                                                        Not mapped
                                                    </div>
                                                    <div className="font-bold text-app-muted-foreground"
                                                        style={{ fontSize: 'var(--tp-xs)' }}>
                                                        Tap to pick target account
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <ChevronRight size={16} className="text-app-muted-foreground flex-shrink-0" />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </MobileMasterPage>
    )
}

/* Recursive row for the account picker tree */
function AccountPickerRow({ node, level, currentAccountId, onPick, defaultOpen }: {
    node: any; level: number; currentAccountId: number | null; onPick: (id: number) => void; defaultOpen?: boolean
}) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    const [open, setOpen] = useState(!!defaultOpen)
    const isCurrent = node.id === currentAccountId

    return (
        <div>
            <div className="flex items-center gap-1 px-1 mb-1" style={{ paddingLeft: 4 + level * 14 }}>
                {hasChildren ? (
                    <button
                        onClick={() => setOpen(o => !o)}
                        className="flex items-center justify-center rounded-md flex-shrink-0 active:scale-90 transition-transform"
                        style={{
                            width: 26, height: 26,
                            background: open
                                ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)'
                                : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                            color: open ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                            transition: 'transform 150ms, background 150ms',
                            transform: open ? 'rotate(90deg)' : 'none',
                        }}
                        aria-label={open ? 'Collapse' : 'Expand'}>
                        <ChevronRight size={13} />
                    </button>
                ) : (
                    <span className="flex-shrink-0" style={{ width: 26 }} />
                )}
                <button
                    onClick={() => onPick(node.id)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl active:scale-[0.99] transition-all text-left min-w-0"
                    style={{
                        minHeight: 44,
                        background: isCurrent
                            ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                            : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                        border: `1px solid ${isCurrent
                            ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 35%, transparent)'}`,
                    }}>
                    <span className="font-mono font-black tabular-nums flex-shrink-0"
                        style={{
                            fontSize: 'var(--tp-sm)',
                            color: isCurrent ? 'var(--app-primary)' : (level === 0 ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)'),
                            minWidth: 46,
                        }}>
                        {node.code}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                        <div className={`${level === 0 ? 'font-black' : 'font-bold'} text-app-foreground truncate`}
                            style={{ fontSize: 'var(--tp-md)' }}>
                            {node.name}
                        </div>
                        {node.type && level === 0 && (
                            <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                {node.type}
                            </div>
                        )}
                    </div>
                    {hasChildren && (
                        <span className="font-black tabular-nums rounded-full px-1.5 py-0.5 flex-shrink-0"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                color: 'var(--app-muted-foreground)',
                                minWidth: 22, textAlign: 'center',
                            }}>
                            {node.children.length}
                        </span>
                    )}
                    {isCurrent && (
                        <CheckCircle2 size={16} style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                    )}
                </button>
            </div>
            {hasChildren && open && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any) => (
                        <AccountPickerRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            currentAccountId={currentAccountId}
                            onPick={onPick}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ─── Account picker sheet ─── */
function AccountPickerSheet({ event, accounts, currentAccountId, onPick, onClear, onClose }: any) {
    const [search, setSearch] = useState('')
    const activeAccounts = useMemo(() => accounts.filter((a: any) => a.isActive !== false), [accounts])

    // Build tree: parentId → children
    const tree = useMemo(() => {
        const map: Record<string, any> = {}
        for (const a of activeAccounts) map[a.id] = { ...a, children: [] }
        const roots: any[] = []
        for (const a of activeAccounts) {
            const pid = a.parentId ?? a.parent
            if (pid && map[pid]) map[pid].children.push(map[a.id])
            else if (!pid) roots.push(map[a.id])
        }
        // Sort each level by code
        const sort = (nodes: any[]) => {
            nodes.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
            nodes.forEach(n => n.children?.length && sort(n.children))
        }
        sort(roots)
        return roots
    }, [activeAccounts])

    // When searching, flatten matching accounts (still showing code + name).
    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return null
        return activeAccounts
            .filter((a: any) =>
                a.code?.toLowerCase().includes(q)
                || a.name?.toLowerCase().includes(q)
            )
            .slice(0, 80)
    }, [search, activeAccounts])

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        color: '#fff',
                    }}>
                    <Target size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-xl)' }}>
                        Map account
                    </h3>
                    <div className="font-mono font-bold text-app-muted-foreground truncate" style={{ fontSize: 'var(--tp-xs)' }}>
                        {event.event_code}
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

            {/* Search */}
            <div className="flex-shrink-0 px-3 py-2">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by code or name…"
                        className="w-full pl-9 pr-3 bg-app-surface/50 border border-app-border/60 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 outline-none"
                        style={{ height: 42, fontSize: 'var(--tp-xl)' }}
                    />
                </div>
            </div>

            {/* Clear option */}
            {currentAccountId && (
                <div className="flex-shrink-0 px-3 pb-2">
                    <button
                        onClick={onClear}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform"
                        style={{
                            minHeight: 44,
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
                        }}>
                        <XCircle size={14} style={{ color: 'var(--app-error, #ef4444)', flexShrink: 0 }} />
                        <span className="flex-1 text-left font-black" style={{ fontSize: 'var(--tp-md)', color: 'var(--app-error, #ef4444)' }}>
                            Unmap this event
                        </span>
                    </button>
                </div>
            )}

            {/* List / Tree */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 custom-scrollbar">
                {searchResults ? (
                    searchResults.length === 0 ? (
                        <div className="py-8 text-center font-bold text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-md)' }}>
                            No matching accounts
                        </div>
                    ) : searchResults.map((acc: any) => {
                        const isCurrent = acc.id === currentAccountId
                        return (
                            <button key={acc.id}
                                onClick={() => onPick(acc.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 active:scale-[0.99] transition-all"
                                style={{
                                    minHeight: 52,
                                    background: isCurrent
                                        ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                        : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                    border: `1px solid ${isCurrent
                                        ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)'
                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                }}>
                                <span className="font-mono font-black tabular-nums flex-shrink-0"
                                    style={{
                                        fontSize: 'var(--tp-md)',
                                        color: isCurrent ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        minWidth: 50,
                                    }}>
                                    {acc.code}
                                </span>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-bold text-app-foreground truncate"
                                        style={{ fontSize: 'var(--tp-md)' }}>
                                        {acc.name}
                                    </div>
                                    {acc.type && (
                                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                                            style={{ fontSize: 'var(--tp-xxs)' }}>
                                            {acc.type}
                                        </div>
                                    )}
                                </div>
                                {isCurrent && (
                                    <CheckCircle2 size={16} style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                                )}
                            </button>
                        )
                    })
                ) : tree.length === 0 ? (
                    <div className="py-8 text-center font-bold text-app-muted-foreground"
                        style={{ fontSize: 'var(--tp-md)' }}>
                        No accounts available
                    </div>
                ) : (
                    tree.map((node: any) => (
                        <AccountPickerRow
                            key={node.id}
                            node={node}
                            level={0}
                            currentAccountId={currentAccountId}
                            onPick={onPick}
                            defaultOpen={tree.length <= 6}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
