'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import type { ChartOfAccount } from '@/types/erp'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen, FileText,
    RefreshCcw, Library, Zap, Eye, EyeOff, Power, Pencil, X,
    Search, BarChart3, TrendingUp, TrendingDown, Scale, Wallet,
    Maximize2, Minimize2, Loader2, BookOpen, Settings2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-chart-of-accounts'

// ─── Type color map (V2 CSS variables) ────────────────────────
const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    ASSET:     { color: 'var(--app-info, #3B82F6)',    bg: 'color-mix(in srgb, var(--app-info, #3B82F6) 10%, transparent)',    icon: <Wallet size={13} />,       label: 'Asset' },
    LIABILITY: { color: 'var(--app-error, #EF4444)',   bg: 'color-mix(in srgb, var(--app-error, #EF4444) 10%, transparent)',   icon: <TrendingDown size={13} />, label: 'Liability' },
    EQUITY:    { color: '#8b5cf6',                     bg: 'color-mix(in srgb, #8b5cf6 10%, transparent)',                    icon: <Scale size={13} />,        label: 'Equity' },
    INCOME:    { color: 'var(--app-success, #10B981)', bg: 'color-mix(in srgb, var(--app-success, #10B981) 10%, transparent)', icon: <TrendingUp size={13} />,   label: 'Income' },
    EXPENSE:   { color: 'var(--app-warning, #F59E0B)', bg: 'color-mix(in srgb, var(--app-warning, #F59E0B) 10%, transparent)', icon: <BarChart3 size={13} />,     label: 'Expense' },
    REVENUE:   { color: 'var(--app-success, #10B981)', bg: 'color-mix(in srgb, var(--app-success, #10B981) 10%, transparent)', icon: <TrendingUp size={13} />,   label: 'Revenue' },
}

// ─── Account Tree Node ─────────────────────────────────────────
const AccountNode = ({
    node, level, accounts, onEdit, onAddChild, onReactivate
}: {
    node: Record<string, any>
    level: number
    accounts: Record<string, any>[]
    onEdit: (node: Record<string, any>) => void
    onAddChild: (parentId: number) => void
    onReactivate: (id: number) => void
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(level < 1)
    const typeConf = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.ASSET
    const isRoot = level === 0

    return (
        <div className={!node.isActive ? 'opacity-40' : ''}>
            {/* Row */}
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b"
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px',
                    paddingTop: isRoot ? '10px' : '7px',
                    paddingBottom: isRoot ? '10px' : '7px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : 'transparent',
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : `3px solid transparent`,
                    borderBottomColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
                onMouseEnter={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-hover, rgba(255,255,255,0.04))'
                }}
                onMouseLeave={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
            >
                {/* Toggle */}
                <button
                    onClick={() => isParent && setIsOpen(o => !o)}
                    className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0"
                    style={{ color: isParent ? 'var(--app-muted-foreground, #94A3B8)' : 'var(--app-border)' }}
                >
                    {isParent
                        ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeConf.color, opacity: 0.5 }} />
                    }
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: typeConf.bg, color: typeConf.color }}
                >
                    {isParent
                        ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
                        : <FileText size={13} />
                    }
                </div>

                {/* Code + Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                        className="font-mono text-[11px] font-bold flex-shrink-0"
                        style={{ color: 'var(--app-muted-foreground, #94A3B8)' }}
                    >
                        {node.code}
                    </span>
                    <span
                        className={`truncate text-[13px] ${isRoot ? 'font-bold' : 'font-medium'}`}
                        style={{ color: 'var(--app-foreground, var(--app-text, #F1F5F9))' }}
                    >
                        {node.name}
                    </span>
                    {node.subType && (
                        <span
                            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden md:inline"
                            style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.bg}` }}
                        >
                            {node.subType}
                        </span>
                    )}
                    {!node.isActive && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'var(--app-error-bg, rgba(239,68,68,0.12))', color: 'var(--app-error, #EF4444)' }}>
                            Inactive
                        </span>
                    )}
                </div>

                {/* SYSCOHADA */}
                <div className="w-36 hidden lg:flex items-center gap-1.5 flex-shrink-0">
                    {node.syscohadaCode && (
                        <>
                            <span
                                className="text-[9px] font-black px-1.5 py-0.5 rounded"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    color: 'var(--app-muted-foreground, #94A3B8)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}
                            >
                                {node.syscohadaCode}
                            </span>
                            {node.syscohadaClass && (
                                <span className="text-[9px] truncate max-w-[80px]"
                                    style={{ color: 'var(--app-muted-foreground, #94A3B8)' }}>
                                    {node.syscohadaClass}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Type Badge */}
                <div className="w-24 flex-shrink-0 hidden sm:flex items-center">
                    <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.bg}` }}
                    >
                        {typeConf.icon}
                        {typeConf.label}
                    </span>
                </div>

                {/* Balance */}
                <div
                    className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: node.balance < 0 ? 'var(--app-error, #EF4444)' : 'var(--app-foreground, var(--app-text, #F1F5F9))' }}
                >
                    {node.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
                    <button
                        title="Edit Account"
                        onClick={() => onEdit(node)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-border) 50%, transparent)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        title="Add Sub-Account"
                        onClick={() => onAddChild(node.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-primary) 12%, transparent)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <Plus size={13} />
                    </button>
                    {!node.isActive && (
                        <button
                            title="Reactivate"
                            onClick={() => onReactivate(node.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--app-success, #10B981)' }}
                        >
                            <Power size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Children */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: Record<string, any>) => (
                        <AccountNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            accounts={accounts}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onReactivate={onReactivate}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Main Viewer ───────────────────────────────────────────────
export function ChartOfAccountsViewer({ accounts }: { accounts: Record<string, any>[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [searchQuery, setSearchQuery] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [preselectedParentId, setPreselectedParentId] = useState<number | undefined>(undefined)
    const [editingAccount, setEditingAccount] = useState<Record<string, any> | null>(null)
    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; id?: number } | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // KPI stats
    const stats = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        const byType = (t: string) => active.filter(a => a.type === t)
        const sum = (arr: Record<string, any>[]) => arr.reduce((s, a) => s + (Number(a.balance) || 0), 0)
        return [
            { label: 'Total Accounts', value: active.length, color: 'var(--app-primary)', icon: <BookOpen size={14} />, filterKey: null },
            { label: 'Assets', value: byType('ASSET').length, color: 'var(--app-info, #3B82F6)', icon: <Wallet size={14} />, filterKey: 'ASSET' },
            { label: 'Liabilities', value: byType('LIABILITY').length, color: 'var(--app-error, #EF4444)', icon: <TrendingDown size={14} />, filterKey: 'LIABILITY' },
            { label: 'Equity', value: byType('EQUITY').length, color: '#8b5cf6', icon: <Scale size={14} />, filterKey: 'EQUITY' },
            { label: 'Income', value: byType('INCOME').length, color: 'var(--app-success, #10B981)', icon: <TrendingUp size={14} />, filterKey: 'INCOME' },
            { label: 'Expenses', value: byType('EXPENSE').length, color: 'var(--app-warning, #F59E0B)', icon: <BarChart3 size={14} />, filterKey: 'EXPENSE' },
        ]
    }, [accounts])

    // Filter + build tree
    const tree = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter(a => a.isActive)
        if (typeFilter) {
            filtered = filtered.filter(a => a.type === typeFilter)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(q) ||
                a.code.toLowerCase().includes(q) ||
                (a.syscohadaCode?.toLowerCase().includes(q))
            )
        }
        const map: Record<string, any> = {}
        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
        const roots: Record<string, any>[] = []
        filtered.forEach(a => {
            if (a.parentId && map[a.parentId]) map[a.parentId].children.push(map[a.id])
            else if (!a.parentId) roots.push(map[a.id])
        })
        return roots
    }, [accounts, showInactive, searchQuery, typeFilter])

    // Handlers
    async function handleCreate(formData: FormData) {
        const data = {
            code: formData.get('code') as string,
            name: formData.get('name') as string,
            type: formData.get('type') as string,
            subType: formData.get('subType') as string,
            parentId: formData.get('parentId') ? parseInt(formData.get('parentId') as string) : undefined,
            syscohadaCode: formData.get('syscohadaCode') as string,
            syscohadaClass: formData.get('syscohadaClass') as string,
        }
        startTransition(async () => {
            const { createAccount } = await import('@/app/actions/finance/accounts')
            try {
                await createAccount(data)
                setIsAdding(false)
                setPreselectedParentId(undefined)
                router.refresh()
                toast.success('Account created.')
            } catch (e: unknown) {
                toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
            }
        })
    }

    async function handleUpdate(formData: FormData) {
        if (!editingAccount) return
        const data = {
            code: formData.get('code') as string,
            name: formData.get('name') as string,
            type: formData.get('type') as string,
            subType: formData.get('subType') as string,
            parentId: formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null,
            syscohadaCode: formData.get('syscohadaCode') as string,
            syscohadaClass: formData.get('syscohadaClass') as string,
            isActive: true,
        }
        startTransition(async () => {
            const { updateChartOfAccount } = await import('@/app/actions/finance/accounts')
            try {
                await updateChartOfAccount(editingAccount.id, data)
                setEditingAccount(null)
                router.refresh()
                toast.success('Account updated.')
            } catch (err: unknown) {
                toast.error('Update Error: ' + (err instanceof Error ? err.message : String(err)))
            }
        })
    }

    const handleConfirmAction = () => {
        if (!pendingAction) return
        if (pendingAction.type === 'reactivate' && pendingAction.id) {
            startTransition(async () => {
                const { reactivateChartOfAccount } = await import('@/app/actions/finance/accounts')
                try { await reactivateChartOfAccount(pendingAction.id!); router.refresh() }
                catch (e: unknown) { toast.error('Error: ' + (e instanceof Error ? e.message : String(e))) }
            })
        } else if (pendingAction.type === 'recalculate') {
            startTransition(async () => {
                await recalculateAccountBalances()
                router.refresh()
                toast.success('Balances recalculated.')
            })
        }
        setPendingAction(null)
    }

    const openAddModal = (parentId?: number) => { setPreselectedParentId(parentId); setIsAdding(true) }

    // Computed totals for footer
    const footerStats = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        const totalBalance = active.reduce((s, a) => s + (Number(a.balance) || 0), 0)
        const withBalance = active.filter(a => Number(a.balance) !== 0).length
        return { totalBalance, withBalance, totalActive: active.length }
    }, [accounts])

    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Page Header ───────────────────────────────── */}
            {!focusMode && <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6">
                <div className="flex items-center gap-3">
                    <div
                        className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                    >
                        <BookOpen size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            Chart of Accounts
                        </h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {accounts.length} Accounts · Account Hierarchy
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                        data-tour="posting-rules-btn"
                        onClick={() => router.push('/finance/settings/posting-rules?from=coa')}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                        style={{
                            color: 'var(--app-success, #22c55e)',
                            borderColor: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                        }}
                    >
                        <Settings2 size={13} /> Posting Rules
                    </button>
                    <button
                        data-tour="migration-btn"
                        onClick={() => router.push('/finance/chart-of-accounts/migrate')}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                        style={{
                            color: 'var(--app-warning, #F59E0B)',
                            borderColor: 'color-mix(in srgb, var(--app-warning, #F59E0B) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--app-warning, #F59E0B) 8%, transparent)',
                        }}
                    >
                        <Zap size={13} /> Migration
                    </button>
                    <button
                        data-tour="templates-btn"
                        onClick={() => router.push('/finance/chart-of-accounts/templates?from=coa')}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            borderColor: 'var(--app-border)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <Library size={13} /> Templates
                    </button>
                    <button
                        data-tour="audit-btn"
                        onClick={() => setPendingAction({ type: 'recalculate', title: 'Recalculate Balances?', description: 'Rebuild all account balances from posted journal entries.', variant: 'warning' })}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                    >
                        <RefreshCcw size={13} className={isPending ? 'animate-spin' : ''} /> Audit
                    </button>
                    <button
                        data-tour="add-account-btn"
                        onClick={() => openAddModal()}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                        style={{
                            background: 'var(--app-primary)',
                            color: '#fff',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}
                    >
                        <Plus size={14} /> New Account
                    </button>
                    <PageTour tourId="finance-chart-of-accounts" />
                    <button
                        data-tour="focus-mode-btn"
                        onClick={() => setFocusMode(p => !p)}
                        title="Toggle Focus Mode (Ctrl+Q)"
                        className="p-1.5 rounded-xl border transition-all"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                    >
                        {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>}

            {/* ── KPI Strip ─────────────────────────────────── */}
            {!focusMode && <div data-tour="kpi-strip" className="flex-shrink-0 mb-4 px-4 md:px-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                {stats.map(s => {
                    const isActive = typeFilter === s.filterKey || (s.filterKey === null && typeFilter === null)
                    return (
                        <button
                            key={s.label}
                            onClick={() => setTypeFilter(typeFilter === s.filterKey ? null : s.filterKey)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: isActive
                                    ? `color-mix(in srgb, ${s.color} 8%, var(--app-surface))`
                                    : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: isActive
                                    ? `2px solid color-mix(in srgb, ${s.color} 40%, transparent)`
                                    : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                cursor: 'pointer',
                                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                            }}
                        >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} ${isActive ? '18' : '10'}%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] font-bold uppercase tracking-wider truncate"
                                    style={{ color: isActive ? s.color : 'var(--app-muted-foreground, #94A3B8)' }}>{s.label}</div>
                                <div className="text-sm font-black tabular-nums"
                                    style={{ color: 'var(--app-foreground, var(--app-text))' }}>{s.value}</div>
                            </div>
                        </button>
                    )
                })}
            </div>}

            {/* ── Unified Toolbar ────────────────────────────── */}
            <div data-tour="search-bar" className="flex items-center gap-2 mb-3 flex-shrink-0 px-4 md:px-6">
                {/* Focus mode: title label on the left */}
                {focusMode && (
                    <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                color: 'var(--app-primary)',
                            }}>
                            <BookOpen size={12} />
                            <span>{accounts.filter(a => a.isActive).length}</span>
                        </div>
                        {typeFilter && (
                            <button
                                onClick={() => setTypeFilter(null)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    color: 'var(--app-primary)',
                                }}>
                                {typeFilter} <X size={10} />
                            </button>
                        )}
                    </div>
                )}

                {/* Search */}
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, code, SYSCOHADA... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] rounded-xl outline-none transition-all"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: 'var(--app-foreground, var(--app-text))',
                        }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--app-border)'; (e.target as HTMLElement).style.background = 'var(--app-surface)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                    />
                </div>

                {/* Show Inactive Toggle */}
                {accounts.some(a => !a.isActive) && (
                    <button
                        onClick={() => setShowInactive(p => !p)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                        style={{
                            background: showInactive ? 'color-mix(in srgb, var(--app-warning, #F59E0B) 10%, transparent)' : 'transparent',
                            color: showInactive ? 'var(--app-warning, #F59E0B)' : 'var(--app-muted-foreground)',
                            borderColor: showInactive ? 'color-mix(in srgb, var(--app-warning, #F59E0B) 30%, transparent)' : 'var(--app-border)',
                        }}
                    >
                        {showInactive ? <Eye size={13} /> : <EyeOff size={13} />}
                        <span className="hidden sm:inline">{showInactive ? 'Showing Inactive' : 'Show Inactive'}</span>
                    </button>
                )}

                {/* Focus mode: exit button */}
                {focusMode && (
                    <button
                        onClick={() => setFocusMode(false)}
                        title="Exit Focus Mode (Ctrl+Q)"
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all flex-shrink-0 text-[11px] font-bold"
                        style={{
                            color: 'var(--app-primary)',
                            borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                        }}
                    >
                        <Minimize2 size={13} /> Exit
                    </button>
                )}
            </div>

            {/* ── Inline Add Form ────────────────────────────── */}
            {isAdding && (
                <div
                    className="flex-shrink-0 mb-3 mx-4 md:mx-6 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderColor: 'var(--app-border)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                            {preselectedParentId ? 'Add Sub-Account' : 'Add Root Account'}
                        </h3>
                        <button
                            onClick={() => { setIsAdding(false); setPreselectedParentId(undefined) }}
                            className="p-1 rounded-lg transition-colors"
                            style={{ color: 'var(--app-muted-foreground)' }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <form action={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
                        {[
                            { name: 'code', label: 'Code', placeholder: '1010', type: 'input', mono: true },
                            { name: 'name', label: 'Name', placeholder: 'Account Name', type: 'input' },
                        ].map(f => (
                            <div key={f.name}>
                                <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{f.label}</label>
                                <input
                                    name={f.name}
                                    placeholder={f.placeholder}
                                    required
                                    className={`w-full text-[12px] px-2.5 py-2 rounded-xl outline-none transition-all ${f.mono ? 'font-mono font-bold' : ''}`}
                                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                                />
                            </div>
                        ))}
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Type</label>
                            <select name="type" className="w-full text-[12px] px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Sub-Type</label>
                            <select name="subType" className="w-full text-[12px] px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                                <option value="">None</option>
                                <option value="CASH">Cash</option>
                                <option value="BANK">Bank</option>
                                <option value="RECEIVABLE">Receivable</option>
                                <option value="PAYABLE">Payable</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Parent</label>
                            <select name="parentId" defaultValue={preselectedParentId || ''} className="w-full text-[11px] font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                                <option value="">(Root)</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>SYSCOHADA Code</label>
                            <input name="syscohadaCode" placeholder="e.g. 57" className="w-full text-[11px] font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }} />
                        </div>
                        <div className="flex gap-2 items-end">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex-1 py-2 rounded-xl text-[12px] font-black text-white transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                            >
                                {isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Tree Table ─────────────────────────────────── */}
            <div
                data-tour="account-tree"
                className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
            >
                {/* Column Headers */}
                <div
                    className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 border-b text-[10px] font-black uppercase tracking-wider"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                        color: 'var(--app-muted-foreground)',
                    }}
                >
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Account</div>
                    <div className="w-36 hidden lg:block flex-shrink-0" style={{ color: 'var(--app-success, #10B981)' }}>SYSCOHADA</div>
                    <div className="w-24 hidden sm:block flex-shrink-0">Type</div>
                    <div className="w-28 text-right flex-shrink-0">Balance</div>
                    <div className="w-16 flex-shrink-0" />
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                    {isPending && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        </div>
                    )}

                    {!isPending && tree.map(node => (
                        <AccountNode
                            key={node.id}
                            node={node}
                            level={0}
                            accounts={accounts}
                            onEdit={setEditingAccount}
                            onAddChild={openAddModal}
                            onReactivate={(id) => setPendingAction({
                                type: 'reactivate', title: 'Reactivate Account?',
                                description: 'This will reactivate the deactivated account.',
                                variant: 'warning', id,
                            })}
                        />
                    ))}

                    {!isPending && tree.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <BookOpen size={36} className="mb-3 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                            <p className="text-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {searchQuery ? 'No accounts match your search' : 'No accounts defined yet'}
                            </p>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                {searchQuery ? 'Try a different code or name.' : 'Click "New Account" to start building your chart of accounts.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold mx-4 md:mx-6 rounded-b-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none',
                    marginTop: '-1px',
                    marginBottom: '8px',
                    color: 'var(--app-muted-foreground)',
                }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span>{footerStats.totalActive} active accounts</span>
                    <span style={{ color: 'var(--app-border)' }}>·</span>
                    <span>{footerStats.withBalance} with balance</span>
                    {typeFilter && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-primary)' }}>Filtered: {typeFilter}</span>
                            <button onClick={() => setTypeFilter(null)} className="underline" style={{ color: 'var(--app-primary)' }}>Clear</button>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    Net: {footerStats.totalBalance.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>

            {/* ── Edit Modal ─────────────────────────────────── */}
            {editingAccount && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditingAccount(null) }}
                >
                    <div
                        className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                    >
                        {/* Modal Header */}
                        <div
                            className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                                >
                                    <Pencil size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black" style={{ color: 'var(--app-foreground)' }}>Edit Account</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {editingAccount.code} · {editingAccount.name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingAccount(null)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5">
                            <form action={handleUpdate}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    {[
                                        { name: 'code', label: 'Account Code', defaultValue: editingAccount.code, mono: true },
                                        { name: 'name', label: 'Display Name', defaultValue: editingAccount.name },
                                        { name: 'syscohadaCode', label: 'SYSCOHADA Code', defaultValue: editingAccount.syscohadaCode || '', mono: true },
                                        { name: 'syscohadaClass', label: 'SYSCOHADA Class', defaultValue: editingAccount.syscohadaClass || '' },
                                    ].map(f => (
                                        <div key={f.name} className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>{f.label}</label>
                                            <input
                                                name={f.name}
                                                defaultValue={f.defaultValue}
                                                className={`w-full px-3 py-2.5 rounded-xl outline-none transition-all text-[13px] ${f.mono ? 'font-mono font-bold' : 'font-medium'}`}
                                                style={{ background: 'color-mix(in srgb, var(--app-bg, #020617) 50%, var(--app-surface))', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            />
                                        </div>
                                    ))}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>Financial Type</label>
                                        <select name="type" defaultValue={editingAccount.type} className="w-full px-3 py-2.5 rounded-xl outline-none text-[13px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-bg, #020617) 50%, var(--app-surface))', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>Sub-Type</label>
                                        <select name="subType" defaultValue={editingAccount.subType || ''} className="w-full px-3 py-2.5 rounded-xl outline-none text-[13px] font-medium" style={{ background: 'color-mix(in srgb, var(--app-bg, #020617) 50%, var(--app-surface))', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            <option value="">Standard Ledger</option>
                                            <option value="CASH">Cash</option>
                                            <option value="BANK">Bank</option>
                                            <option value="RECEIVABLE">Receivable</option>
                                            <option value="PAYABLE">Payable</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1" style={{ gridColumn: '1 / -1' }}>
                                        <label className="text-[9px] font-black uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>Parent Account</label>
                                        <select name="parentId" defaultValue={editingAccount.parentId || ''} className="w-full px-3 py-2.5 rounded-xl outline-none text-[12px] font-mono" style={{ background: 'color-mix(in srgb, var(--app-bg, #020617) 50%, var(--app-surface))', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            <option value="">[Top Level Root]</option>
                                            {accounts.filter(a => a.id !== editingAccount.id).map(a => (
                                                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => setEditingAccount(null)}
                                        className="flex-1 py-3 rounded-xl text-[13px] font-bold border transition-all"
                                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="flex-2 px-8 py-3 rounded-xl text-[13px] font-black text-white transition-all disabled:opacity-50 flex items-center gap-2"
                                        style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                                    >
                                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={15} />}
                                        {isPending ? 'Saving...' : 'Apply Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={open => { if (!open) setPendingAction(null) }}
                onConfirm={handleConfirmAction}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={pendingAction?.variant ?? 'warning'}
            />
        </div>
    )
}
